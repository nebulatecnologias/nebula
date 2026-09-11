# vendor/

Biblioteca de terceiros copiada para dentro do repositório, em vez de
vinda de um CDN.

- **supabase.js** — `@supabase/supabase-js@2.45.4`, build UMD, exporta o
  global `supabase`. Obtido com `npm pack @supabase/supabase-js@2.45.4`.

Porque não um CDN: se a rede de um aluno bloquear o cdn.jsdelivr.net, a
área de membros deixa de abrir. Assim, a aplicação só depende do domínio
onde está alojada.

Para atualizar: `npm pack @supabase/supabase-js@<versão>`, extrair
`package/dist/umd/supabase.js` para aqui e testar a entrada.
