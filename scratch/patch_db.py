import os

path = r"c:\Github\ProcureFlow-App\services\db.ts"
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

new_func = [
    "    createPO: async (po: PORequest): Promise<string> => {\n",
    "        // Use the atomic RPC to ensure all parts of the PO are created in a single transaction (Fix F2).\n",
    "        // This also bypasses RLS restrictions on po_lines for non-admin users via SECURITY DEFINER.\n",
    "        const header = {\n",
    "            request_date: po.requestDate,\n",
    "            requester_id: po.requesterId,\n",
    "            site_id: po.siteId,\n",
    "            supplier_id: po.supplierId,\n",
    "            status: po.status,\n",
    "            total_amount: po.totalAmount,\n",
    "            customer_name: po.customerName,\n",
    "            reason_for_request: po.reasonForRequest,\n",
    "            comments: po.comments\n",
    "        };\n",
    "\n",
    "        const lines_data = po.lines.map(l => ({\n",
    "            id: l.id,\n",
    "            item_id: l.itemId,\n",
    "            sku: l.sku,\n",
    "            item_name: l.itemName,\n",
    "            quantity_ordered: l.quantityOrdered,\n",
    "            quantity_received: l.quantityReceived || 0,\n",
    "            unit_price: l.unitPrice,\n",
    "            total_price: l.totalPrice,\n",
    "            concur_po_number: l.concurPoNumber\n",
    "        }));\n",
    "\n",
    "        const approval = po.approvalHistory && po.approvalHistory.length > 0 ? {\n",
    "            approver_id: po.requesterId, \n",
    "            approver_name: po.approvalHistory[0].approverName,\n",
    "            action: po.approvalHistory[0].action,\n",
    "            date: po.approvalHistory[0].date,\n",
    "            comments: po.approvalHistory[0].comments\n",
    "        } : null;\n",
    "\n",
    "        const { data, error } = await supabase.rpc('create_po_atomic', {\n",
    "            p_request_id: po.id,\n",
    "            p_header: header,\n",
    "            p_lines: lines_data,\n",
    "            p_approval: approval\n",
    "        });\n",
    "\n",
    "        if (error) {\n",
    "            console.error('Failed to create PO atomic:', error);\n",
    "            throw error;\n",
    "        }\n",
    "\n",
    "        return data || po.id;\n",
    "    },\n"
]

# Use the exact indices from the view_file output (714 to 767)
# 714 (1-indexed) is 713 (0-indexed)
# 767 (1-indexed) is 766 (0-indexed)
start_idx = 713
end_idx = 766

new_lines = lines[:start_idx] + new_func + lines[end_idx+1:]
with open(path, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print(f"Successfully replaced lines {start_idx+1} to {end_idx+1}")
