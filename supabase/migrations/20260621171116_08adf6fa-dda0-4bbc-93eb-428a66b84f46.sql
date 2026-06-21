-- ═══════════════════════════════════════════════════════════════
-- P0.1 — Bloquear elevação de privilégio via profiles.role
-- ═══════════════════════════════════════════════════════════════
-- Papéis ficam em profiles.role. Sem isto, a policy de INSERT/UPDATE
-- permite um usuário se auto-promover a orbia_admin/orbia_staff.
-- Estratégia: gatilho BEFORE que, para sessões de usuário final
-- (auth.role() = 'authenticated'), força role = 'member' no INSERT e
-- impede alteração de role no UPDATE. Concessão de papéis de equipe
-- passa a ser exclusiva de service_role (server functions admin).

create or replace function public.enforce_profile_role_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Somente usuários finais autenticados são restringidos.
  -- service_role / supabase_auth_admin / postgres passam direto.
  if (select auth.role()) = 'authenticated' then
    if tg_op = 'INSERT' then
      new.role := 'member';
    elsif tg_op = 'UPDATE' then
      if new.role is distinct from old.role then
        raise exception 'Alteração de papel (role) não permitida.'
          using errcode = 'insufficient_privilege';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_profile_role_guard_ins on public.profiles;
drop trigger if exists enforce_profile_role_guard_upd on public.profiles;

create trigger enforce_profile_role_guard_ins
  before insert on public.profiles
  for each row execute function public.enforce_profile_role_guard();

create trigger enforce_profile_role_guard_upd
  before update on public.profiles
  for each row execute function public.enforce_profile_role_guard();

-- ═══════════════════════════════════════════════════════════════
-- P0.2 — fiscal_configs: esconder segredos das leituras de membro
-- ═══════════════════════════════════════════════════════════════
-- Privilégio de tabela cobre todas as colunas; para restringir colunas
-- é preciso revogar SELECT de tabela e conceder SELECT por coluna.
-- Segredos ocultos: cert_password, nfce_csc_token, nfce_csc_id.
-- (cert_path permanece — é caminho em bucket privado, lido por RLS.)

revoke select on public.fiscal_configs from authenticated;
revoke select on public.fiscal_configs from anon;

grant select (
  id, client_id, cnpj, company_name, tax_regime,
  default_cfop, default_cst, default_ncm, cert_expires_at,
  created_at, updated_at, cert_path, state_uf, state_registration,
  municipal_registration, municipality_code, focus_synced_at,
  auto_emit_nfe, auto_emit_nfce, auto_emit_nfse, iss_retido,
  natureza_operacao_nfse, focus_environment
) on public.fiscal_configs to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- P0.3 — oauth_connections: esconder tokens/metadata das leituras de membro
-- ═══════════════════════════════════════════════════════════════
-- Segredos ocultos: access_token, refresh_token, metadata.

revoke select on public.oauth_connections from authenticated;
revoke select on public.oauth_connections from anon;

grant select (
  id, client_id, provider, external_account,
  token_expires_at, scopes, is_active, last_refreshed_at,
  created_at, updated_at
) on public.oauth_connections to authenticated;

-- ═══════════════════════════════════════════════════════════════
-- P0.4 — nfe_fiscal_events: escrita apenas por service_role
-- ═══════════════════════════════════════════════════════════════
-- Policy atual "system write" usa USING(true) para o role public,
-- permitindo qualquer autenticado inserir/alterar/excluir eventos fiscais.

drop policy if exists "nfe_fiscal_events: system write" on public.nfe_fiscal_events;

create policy "nfe_fiscal_events: service write"
  on public.nfe_fiscal_events
  for all
  to service_role
  using (true)
  with check (true);