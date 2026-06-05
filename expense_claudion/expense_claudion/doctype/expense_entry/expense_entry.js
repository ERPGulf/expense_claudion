frappe.ui.form.on('Expense Entry', {
    setup(frm) {
        frm.set_query('claimant_type', () => {
            return {
                query: 'expense_claudion.api.get_party_doctypes'
            };
        });

        frm.set_query('tax_account', () => {
            return {
                filters: {
                    account_type: 'Tax'
                }
            };
        });
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
            let filters = {};

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
    }
});


frappe.ui.form.on('Expense Lines', {
    tax_template(frm, cdt, cdn) {
        const row = locals[cdt][cdn];

        if (!row.tax_template) {
            row.tax_ = 0;
            calculate_row_total(row);
            update_summary(frm);
            frm.refresh_field('expense_lines');
            return;
        }

        frappe.db.get_value(
            'Tax Template',
            row.tax_template,
            'percentage_'
        ).then(r => {
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

        if (flt(row.tax_) > 0) {
            taxed_lines += 1;
        }
    });

    frm.set_value('expense_subtotal', expense_subtotal);
    frm.set_value('total_vat', total_vat);
    frm.set_value('taxed_lines', taxed_lines);
    frm.set_value('grand_total', grand_total);
}