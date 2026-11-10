# Custos — componentes a orçar

**Os preços NÃO foram consultados nesta sessão.** Nenhum valor abaixo é estimativa: preencha com cotações datadas antes de decidir.

| Componente | Necessidade | Opções a cotar | Mensal (R$) | Cotado em |
|---|---|---|---|---|
| Servidor de aplicação | homologação na VPS atual (decidido); servidor próprio (2 vCPU / 4 GB sugeridos) ao ativar vendas | provedor atual (Hostinger) ou outro | — | — |
| PostgreSQL | no mesmo servidor ou gerenciado | — | — | — |
| Backup externo + WAL (RPO 15 min) | armazenamento compatível com S3, com imutabilidade se possível | — | — | — |
| Armazenamento de mídia + CDN | fotos e downloads | — | — | — |
| E-mail transacional | confirmações, redefinição de senha | — | — | — |
| Domínio | `.org.br` ou outro | registro.br | — | — |
| Monitoramento externo de disponibilidade | verificação de `/api/health` | — | — | — |
| Provedor de pagamento | custo variável por transação (Pix, cartão, boleto) | — | variável | — |

Custos variáveis: tarifa por transação, armazenamento que cresce com mídias, e-mails acima da franquia. Uma CDN não garante otimização de imagens nem WAF gratuito: conferir no plano.
