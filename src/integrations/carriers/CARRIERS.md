# Transportadoras Fulfillly — decisão de produto

## Modelo oficial: Melhor Envio como proxy único

A spec original lista integrações diretas com Correios, Jadlog, J&T, Total Express, Latam Cargo e Azul Cargo.

**Decisão Orbia (2026):** todas essas transportadoras são cotadas e etiquetadas via **Melhor Envio** quando `melhor_envio` está ativo em `client_carrier_configs`.

### Por quê

- Uma única OAuth e um único contrato de frete por lojista
- Cotação multi-carrier em uma chamada (`routing-engine.server.ts`)
- Etiquetas e rastreamento unificados
- Menor superfície de manutenção vs. 6 APIs com contratos distintos

### Stubs diretos

Os providers em `stubs.ts` existem apenas para compatibilidade de schema. Não devem ser ativados em produção sem implementação dedicada.

### Roadmap opcional

Integração direta com **um** carrier (ex. Jadlog contrato próprio) só se o lojista exigir fora do ME e houver volume que justifique o esforço (~2–3 semanas por carrier).
