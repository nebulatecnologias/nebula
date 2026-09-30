-- Migração 20260916211152 «confirmar_pagamento_pelo_servidor», tal como ficou no registo do Supabase
-- (supabase_migrations.schema_migrations). Aplicada antes de a Academia ter os
-- ficheiros no repositório; guardada aqui a 30/09/2026 para o esquema ter história.
-- Não se volta a correr: já está na base.

/* Um pagamento pelo M-Pesa nao tem ninguem a confirma-lo.

   Ate aqui, confirmar_pagamento exigia um humano com acesso ao fluxo de caixa
   -- o que faz todo o sentido quando alguem carrega no botao Confirmar. Mas a
   cobranca automatica chega sem sessao nenhuma: quem a confirma e o servidor,
   depois de o proprio M-Pesa devolver INS-0.

   Em vez de escrever uma segunda funcao que faca o mesmo (duas copias da mesma
   regra acabam sempre a discordar uma da outra), alarga-se a porta: alem do
   admin e de quem tem o fluxo, entra tambem quem se apresente com a chave de
   servico. Isso nao abre nada de novo -- a chave de servico ja passa por cima
   de todas as politicas. So torna possivel fazer as coisas pela porta certa. */
create or replace function privado.sou_servico()
returns boolean
language sql stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    ''
  ) = 'service_role'
$$;

comment on function privado.sou_servico() is
  'Verdadeiro so quando quem chama traz a chave de servico no JWT. Nunca um browser.';

create or replace function public.confirmar_pagamento(
  p_lancamento_id bigint, p_metodo text default null, p_data date default null)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  l         public.lancamentos%rowtype;
  v_insc    public.inscricoes%rowtype;
  v_email   text;
  v_util    uuid;
  v_curso   text;
  v_acesso  text := 'nao aplicavel';
begin
  if not (privado.sou_admin() or privado.tenho_acesso('fluxo') or privado.sou_servico()) then
    raise exception 'Não tens permissão para confirmar pagamentos.';
  end if;

  select * into l from public.lancamentos where id = p_lancamento_id and removido_em is null;
  if not found then raise exception 'Lançamento não encontrado.'; end if;
  if l.tipo <> 'Entrada' then raise exception 'Só se confirmam entradas.'; end if;
  if l.estado = 'Confirmado' then
    return jsonb_build_object('ja_estava', true, 'acesso', 'sem alteração');
  end if;

  update public.lancamentos
     set estado  = 'Confirmado',
         data    = least(coalesce(p_data, current_date), current_date),
         metodo  = coalesce(nullif(p_metodo,'')::metodo_pagamento, metodo)
   where id = p_lancamento_id;

  -- O acesso à Academia só faz sentido quando o lançamento pertence a uma inscrição
  if l.inscricao_id is null then
    return jsonb_build_object('confirmado', true, 'acesso', 'lançamento sem inscrição');
  end if;

  select * into v_insc from public.inscricoes where id = l.inscricao_id and removido_em is null;
  select lower(trim(le.email)) into v_email from public.leads le where le.id = v_insc.lead_id;

  select c.id into v_curso
    from academia.cursos c
    join public.turmas t on t.oferta_id = c.oferta_id
   where t.id = v_insc.turma_id and c.removido_em is null and c.publicado
   limit 1;

  if v_curso is null then
    v_acesso := 'a oferta não tem curso publicado na Academia';
  elsif v_email is null then
    v_acesso := 'o aluno não tem email registado';
  else
    select u.id into v_util from public.utilizadores u
     where lower(u.email) = v_email and u.removido_em is null limit 1;
    if v_util is null then
      v_acesso := 'ainda não há conta na Academia para ' || v_email;
    elsif exists (select 1 from academia.acessos a
                   where a.utilizador_id = v_util and a.curso_id = v_curso) then
      v_acesso := 'já tinha acesso';
    else
      insert into academia.acessos (utilizador_id, curso_id, origem, inscricao_id, concedido_por, nota)
      values (v_util, v_curso, 'oferta', v_insc.id, auth.uid(),
              case when auth.uid() is null
                   then 'Aberto pelo pagamento automático M-Pesa'
                   else 'Aberto pelo Payflow ao confirmar o pagamento' end);
      v_acesso := 'acesso concedido';
    end if;
  end if;

  return jsonb_build_object('confirmado', true, 'valor', l.valor, 'acesso', v_acesso);
end;
$function$;
