# PRD: Betchat

## Objetivo (1 frase)
Permitir que grupos de WhatsApp criem mercados de previsão privados onde membros apostam em eventos mensuráveis do próprio chat, com distribuição pari-mutuel onde a banca nunca ganha além da taxa fixa.

## O que faz (MVP)
- **Criar bet privada**: qualquer membro abre uma rodada vinculada ao grupo, define a pergunta, a janela de apostas e a margem de tolerância
- **Apostar com valor livre**: cada participante escolhe quanto quer apostar (ex: R$ 1 a R$ 50) e faz seu palpite numérico
- **Odds dinâmicas durante as apostas**: o sistema mostra a odd estimada de cada palpite com base em quantas pessoas estão perto daquele valor
- **Admin revela resultado**: após o fechamento, o admin (ou o criador da bet) insere o valor real
- **Algoritmo pari-mutuel**: distribui 90% do pool total (após taxa de 10%) entre quem acertou dentro da margem, ponderado por aposta × precisão²
- **Acumulação**: saldo não distribuído acumula para a próxima rodada do grupo (sem taxa sobre o acumulado)
- **Carteira/saldo por jogador**: cada membro vê seu histórico de apostas, ganhos e saldo atual
- **Acumulação visível**: o saldo acumulado é exibido como "pool extra" na próxima rodada

## O que NÃO faz (fora de escopo do MVP)
- **Integração real com WhatsApp**: o app é independente — o grupo de WhatsApp é apenas o contexto social (não há bot lendo mensagens do grupo)
- **Pagamentos reais**: o MVP trabalha com saldo fictício/simulado (Pix real fica pra depois)
- **Múltiplas bets simultâneas**: uma bet por vez por grupo
- **Chat interno**: as discussões continuam no WhatsApp, o app é só pra palpites e resultados
- **Tipos de aposta automáticos**: a coleta de dados (ex: contar caracteres) é manual — o admin insere o valor real
- **Sistema de reputação/rankings**
- **Notificações push**

## Critério de sucesso
O MVP está pronto quando: um grupo consegue criar uma bet, 5+ membros fazem palpites com valores diferentes, o admin fecha a rodada, e o algoritmo distribui corretamente o pool (R$ 45 após taxa, com pesos proporcionais à precisão² × aposta), e o saldo acumulado aparece na rodada seguinte.

## Algoritmo de Distribuição (versão final)

```
Margem = 20% (definido pelo admin na criação da bet)

Para cada participante i dentro da margem:
  erro_i = |palpite_i - valor_real| / valor_real
  precisao_i = max(0, 1 - erro_i / margem)
  peso_i = aposta_i × precisao_i²

Se erro_i == margem → precisao = 0 → peso = 0 (perdeu)

premio_i = (peso_i / soma_pesos) × (pool_total × 0.9)

Acumula para próxima rodada: pool_total × 0.9 — soma(premios)
```
