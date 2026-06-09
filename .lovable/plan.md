## Problema

A Visão Geral está quebrando com erro de hidratação:

```text
servidor: R$ 842 mil
cliente:  R$ 842,0 mil
```

A causa é a função `formatBRL` em `src/lib/format.ts`, que usa `Intl.NumberFormat` com `notation: "compact"`. O runtime do servidor (Cloudflare Worker) e o navegador embarcam dados de localização (ICU) diferentes, então o mesmo número compacto sai formatado de forma diferente nos dois ambientes — e o React aborta a hidratação.

## Solução

Reescrever apenas o caminho compacto de `formatBRL` para gerar a string de forma 100% determinística (sem `notation: "compact"`), produzindo sempre o mesmo resultado no servidor e no cliente.

Regra de formatação compacta proposta (pt-BR):
- ≥ 1.000.000 → `R$ X,Y mi` (1 casa decimal, vírgula como separador)
- ≥ 1.000 → `R$ X mil` (sem casas decimais, como hoje no servidor: `R$ 842 mil`)
- < 1.000 → cai no caminho normal (`R$ 842`)

O caminho não-compacto (`Intl.NumberFormat` sem `notation`) é estável entre ambientes e permanece como está.

## Verificação

Após a alteração, recarregar a Visão Geral e confirmar no console que o erro `Hydration failed` desapareceu, e que os valores na tabela de clientes e nos KPIs aparecem corretamente (ex.: `R$ 842 mil`, `R$ 1,3 mi`).

## Detalhes técnicos

- Arquivo único alterado: `src/lib/format.ts`.
- Substituir o bloco `if (compact ...)` que usa `notation: "compact"` por construção manual da string a partir de divisão por `1_000_000` / `1_000` e `toFixed`, trocando `.` por `,`.
- Nenhuma mudança de dados, rotas ou componentes é necessária — os dados mock já são estáticos e determinísticos.
