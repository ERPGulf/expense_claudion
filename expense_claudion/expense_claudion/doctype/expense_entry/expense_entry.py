# Copyright (c) 2026, erpgulf.com
# License: see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt
from erpnext.accounts.general_ledger import make_gl_entries
from erpnext.accounts.utils import get_account_currency


class ExpenseEntry(Document):

    def on_submit(self):
        self.make_gl_entries()

    def on_cancel(self):
        frappe.db.sql(
            """
            DELETE FROM `tabGL Entry`
            WHERE voucher_type=%s AND voucher_no=%s
            """,
            (self.doctype, self.name),
        )

    @frappe.whitelist()
    def get_gl_preview(self):
        return self.build_gl_entries(preview=True)

    def make_gl_entries(self):
        gl_entries = self.build_gl_entries(preview=False)
        make_gl_entries(gl_entries, cancel=False, adv_adj=False)

    def build_gl_entries(self, preview=False):
        gl_entries = []
        total_tax = 0
        expense_accounts = []

        for row in self.expense_lines:
            expense_accounts.append(row.account)

            gl_entries.append(
                self.get_gl_dict(
                    account=row.account,
                    debit=row.amount,
                    credit=0,
                    against_account=self.payable_account,
                    remarks=row.description or self.remarks or "Expense",
                )
            )

            total_tax += flt(row.tax_amount)


        if total_tax > 0 and self.tax_account:
            expense_accounts.append(self.tax_account)

            gl_entries.append(
                self.get_gl_dict(
                    account=self.tax_account,
                    debit=total_tax,
                    credit=0,
                    against_account=self.payable_account,
                    remarks="Tax",
                )
            )


        gl_entries.append(
            self.get_gl_dict(
                account=self.payable_account,
                debit=0,
                credit=self.grand_total,
                against_account=", ".join(expense_accounts),
                remarks="Expense Settlement",
            )
        )

        return gl_entries

    def get_gl_dict(
        self,
        account,
        debit=0,
        credit=0,
        against_account=None,
        remarks=None,
    ):
        """
        Correct GL Entry for ERPNext v15
        """

        account_type, is_group = frappe.db.get_value(
            "Account", account, ["account_type", "is_group"]
        )

        if is_group:
            frappe.throw(f"Account {account} is a Group Account")

        account_currency = get_account_currency(account)

        party_type = None
        party = None

        if account_type in ("Payable", "Receivable"):
            party_type = self.claimant_type
            party = self.party

        debit = flt(debit)
        credit = flt(credit)

        return frappe._dict({
            "posting_date": self.posting_date,
            "company": self.company,
            "voucher_type": self.doctype,
            "voucher_subtype": self.doctype,
            "voucher_no": self.name,
            "account": account,

            "debit": debit,
            "credit": credit,

            "account_currency": account_currency,
            "debit_in_account_currency": debit,
            "credit_in_account_currency": credit,

            "party_type": party_type,
            "party": party,

            "against": against_account,
            "against_account": against_account,

            "cost_center": self.cost_center,
            "remarks": remarks,
            "is_opening": "No",
        })