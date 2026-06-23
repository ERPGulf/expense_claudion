frappe.ui.form.on('Expense Entry', {
    setup(frm) {
        frm.set_query('claimant_type', () => ({
            query: 'expense_claudion.api.get_party_doctypes'
        }));

        frm.set_query('tax_account', () => ({
            filters: { account_type: 'Tax', is_group: 0}
        }));

        frm.set_query('cost_center', () => ({
            filters: {
                is_group: 0
            }
        }));
    },

    onload(frm) {
        if (frm.is_new()) {
            frm.set_value('claimant_type', null);
        }
    },

    claimant_type(frm) {
        frm.set_value('party', null);
    },

    payment_method(frm) {
        frm.set_value('payable_account', null);

        frm.set_query('payable_account', () => {
            let filters = {is_group: 0};

            if (frm.doc.payment_method === 'Reimburse Later') {
                filters.account_type = 'Payable';
            } else if (
                frm.doc.payment_method === 'Cash' ||
                frm.doc.payment_method === 'Petty Cash'
            ) {
                filters.account_type = 'Cash';
            } else if (frm.doc.payment_method === 'Bank Transfer') {
                filters.account_type = 'Bank';
            }

            return { filters };
        });
    },
    refresh(frm) {
    if (frm.is_new()) return;

    if (frm.doc.docstatus === 0) {
        frm.add_custom_button(__('Ledger Preview'), () => {
            show_ledger_preview(frm);
        }, __('Preview'));
    }

    if (frm.doc.docstatus === 1) {
        frm.add_custom_button(__('General Ledger'), () => {
            frappe.set_route('query-report', 'General Ledger', {
                voucher_type: frm.doc.doctype,
                voucher_no: frm.doc.name
            });
        }, __('View'));
    }
}

});




frappe.ui.form.on('Expense Lines', {
    tax_template(frm, cdt, cdn) {
        const row = locals[cdt][cdn];

        if (row.tax_template && !frm.doc.payable_account) {
            frappe.msgprint({
                title: __('Payable Account Required'),
                message: __('Please select a Payable Account before applying tax.'),
                indicator: 'orange'
            });
        }

        if (!row.tax_template) {
            row.tax_ = 0;
            calculate_row_total(row);
            update_summary(frm);
            frm.refresh_field('expense_lines');
            return;
        }

        frappe.db.get_value('Expense Tax Template', row.tax_template, 'percentage_')
            .then(r => {
                row.tax_ = r.message?.percentage_ || 0;
                calculate_row_total(row);
                update_summary(frm);
                frm.refresh_field('expense_lines');
            });
    },

    amount(frm, cdt, cdn) {
        calculate_row_total(locals[cdt][cdn]);
        update_summary(frm);
        frm.refresh_field('expense_lines');
    },

    tax_(frm, cdt, cdn) {
        calculate_row_total(locals[cdt][cdn]);
        update_summary(frm);
        frm.refresh_field('expense_lines');
    },

    expense_lines_remove(frm) {
        update_summary(frm);
    }
});




function show_ledger_preview(frm) {
    frappe.call({
        method: 'get_gl_preview',
        doc: frm.doc,
        callback(r) {
            if (r.message) {
                const d = new frappe.ui.Dialog({
                    title: __('Accounting Ledger Preview'),
                    size: 'large',
                    fields: [{ fieldtype: 'HTML', fieldname: 'html' }]
                });

                d.fields_dict.html.$wrapper.html(render_gl_table(r.message));
                d.show();
            }
        }
    });
}

function render_gl_table(entries) {
    let rows = entries.map(e => `
        <tr>
            <td>${e.account}</td>
            <td class="text-right">${format_currency(e.debit)}</td>
            <td class="text-right">${format_currency(e.credit)}</td>
            <td>${e.remarks || ''}</td>
        </tr>
    `).join('');

    return `
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Account</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Remarks</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}



function calculate_row_total(row) {
    const amount = flt(row.amount);
    const tax_percent = flt(row.tax_);
    row.tax_amount = flt(amount * tax_percent / 100);
    row.total = flt(amount + row.tax_amount);
}

function update_summary(frm) {
    let expense_subtotal = 0;
    let total_vat = 0;
    let grand_total = 0;
    let taxed_lines = 0;

    (frm.doc.expense_lines || []).forEach(row => {
        expense_subtotal += flt(row.amount);
        total_vat += flt(row.tax_amount);
        grand_total += flt(row.total);
        if (flt(row.tax_) > 0) taxed_lines++;
    });

    frm.set_value('expense_subtotal', expense_subtotal);
    frm.set_value('total_vat', total_vat);
    frm.set_value('taxed_lines', taxed_lines);
    frm.set_value('grand_total', grand_total);
}