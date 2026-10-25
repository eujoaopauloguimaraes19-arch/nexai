# NEXAI — sua IA pessoal

Aplicação web responsiva com visual de assistente de IA, pronta para rodar localmente e preparada para instalação como PWA (aplicativo web instalável).

## Recursos incluídos

- Chat com contexto e histórico local.
- Integração de chat com OpenRouter, configurável nas configurações.
- Campo para escolher modelo, com `openrouter/free` como opção inicial (disponibilidade de modelos gratuitos varia).
- Geração de imagens por um endpoint público externo (sujeito a limites, disponibilidade e políticas do provedor).
- Pesquisa instantânea via DuckDuckGo Instant Answer API. Não é uma busca completa da web.
- Extração de texto de PDFs, arquivos de texto, CSV, JSON e código.
- Entrada de voz via Web Speech API em navegadores compatíveis.
- Leitura de respostas em voz alta pelo navegador.
- Criação de respostas com código, sites e outros conteúdos via modelo de IA.
- Tema claro/escuro, interface responsiva e instalação PWA quando suportada.

## Requisitos

- Node.js 20 ou mais recente (Node 18 pode funcionar, mas Node 20+ é recomendado).
- Conexão com a internet para instalar dependências e usar os serviços externos.

## Executar localmente

1. Instale Node.js: https://nodejs.org/
2. Extraia o ZIP.
3. Abra o terminal na pasta `nexai`.
4. Execute:

   ```bash
   npm install
   npm run dev
   ```

5. Abra o endereço que o Vite mostrar, normalmente `http://localhost:5173`.

## Ativar o chat inteligente

1. Crie uma conta em https://openrouter.ai/
2. Consulte os modelos e a disponibilidade de opções gratuitas em https://openrouter.ai/models
3. Crie uma chave em https://openrouter.ai/keys
4. Abra **Configurações** dentro da NEXAI e cole a chave.
5. Deixe `openrouter/free` ou informe um ID de modelo suportado pelo OpenRouter.

A disponibilidade, os limites e os preços dos modelos são definidos pelo provedor e podem mudar. Uma chave de API não garante uso ilimitado gratuito.

## Criar build para publicação

```bash
npm run build
npm run preview
```

O resultado de produção fica na pasta `dist/`. Publique em um serviço de hospedagem estática compatível, como Vercel, Netlify ou Cloudflare Pages.

## Usar como aplicativo no celular

Depois de publicar em HTTPS, abra o site no celular e use a opção do navegador **Adicionar à tela inicial** / **Instalar aplicativo** quando disponível. A experiência é uma PWA; não é um pacote nativo de App Store/Google Play.

## Importante sobre segurança e privacidade

Esta é uma versão inicial para uso pessoal e prototipagem. A chave OpenRouter é armazenada no `localStorage` do navegador e usada em chamadas feitas diretamente do navegador. Isso é conveniente para um projeto pessoal, mas não é adequado para um serviço público multiusuário. Para lançar publicamente, mova chamadas de IA para um backend seguro, mantenha as chaves no servidor, implemente autenticação, limites de uso e regras de privacidade.

O histórico e as preferências ficam no navegador. Não use um computador compartilhado para guardar chaves. Os arquivos são extraídos localmente no navegador antes de enviar texto ao modelo; o texto incluído no prompt será enviado ao provedor de IA quando você pedir uma análise.

## Limitações atuais

- A pesquisa DuckDuckGo é uma API de respostas instantâneas e pode não trazer resultados para qualquer consulta.
- O endpoint de imagens é um serviço público externo e pode ficar indisponível ou ter limites.
- A análise de imagens enviadas ainda não está conectada ao modelo visual; a extração de texto de documentos está disponível.
- A voz depende dos recursos do navegador e de permissões do microfone.
- Não há autenticação, banco de dados remoto ou pagamentos nesta versão inicial.
