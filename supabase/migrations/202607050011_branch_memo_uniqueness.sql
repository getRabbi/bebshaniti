begin;

alter table public.sales
  drop constraint if exists sales_organization_id_invoice_no_key,
  drop constraint if exists sales_organization_id_memo_no_key,
  drop constraint if exists sales_organization_branch_invoice_no_key,
  drop constraint if exists sales_organization_branch_memo_no_key;

alter table public.sales
  add constraint sales_organization_branch_invoice_no_key
    unique (organization_id, branch_id, invoice_no),
  add constraint sales_organization_branch_memo_no_key
    unique (organization_id, branch_id, memo_no);

commit;
