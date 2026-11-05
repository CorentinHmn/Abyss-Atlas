-- One SELECT policy on licensing.organizations instead of two permissive ones (Supabase linter 0006):
-- the operator reads every organization, an active member reads their own one. Writes stay operator-only.

drop policy "Operators manage organizations" on licensing.organizations;
drop policy "Members read their organization" on licensing.organizations;

create policy "Operators and members read organizations"
  on licensing.organizations for select to authenticated
  using ((select licensing.is_operator()) or (select app.is_member(id)));

create policy "Operators create organizations"
  on licensing.organizations for insert to authenticated
  with check ((select licensing.is_operator()));

create policy "Operators update organizations"
  on licensing.organizations for update to authenticated
  using ((select licensing.is_operator()))
  with check ((select licensing.is_operator()));

create policy "Operators delete organizations"
  on licensing.organizations for delete to authenticated
  using ((select licensing.is_operator()));
