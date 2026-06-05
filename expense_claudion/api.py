import frappe

@frappe.whitelist()
def get_party_doctypes(doctype, txt, searchfield, start, page_len, filters):
    return frappe.db.sql(
        """
        SELECT name, name
        FROM `tabDocType`
        WHERE name IN ('Customer','Supplier','Employee','Shareholder')
        AND name LIKE %s
        LIMIT %s OFFSET %s
        """,
        (f"%{txt}%", page_len, start),
    )