# FreeFireHelper 🎮

Treinador independente para quem joga Free Fire: **analisa prints e vídeos escolhidos pelo usuário, oferece orientações por voz em português brasileiro, treinos guiados e estatísticas pessoais**. Não é afiliado à Garena.

## O que funciona
- **Dashboard gamer animado**, escuro, responsivo e com navegação de 5 telas.
- **Análise de print e replay de vídeo**: seleciona arquivo no Android, reconhece texto com ML Kit local, recebe dicas contextualizadas. Em vídeos verifica alguns quadros (amostragem), não examina toda a partida.
- **Coach por voz** com TextToSpeech do Android (depende da voz pt-BR instalada).
- **Diário de partidas**: registra eliminações, colocação, duração, modo e erro percebido. Resumos personalizados, evolução e média.
- **Treinos guiados** e cronômetro, progressão local, favoritos de dicas.
- **Offline** após dependências instaladas. Os registros ficam no aparelho, via armazenamento WebView.

## Limites e jogo limpo
Este aplicativo **não acessa dados internos do Free Fire**, não contém mira automática, macros, monitoramento oculto, injeção, overlay competitivo ou alteração do cliente. Ele não detecta inimigos nem eventos ao vivo. A análise visual é limitada ao texto reconhecido em capturas e quadros amostrados; confira sempre os resultados. Uso somente fora da partida. Consulte as regras da Garena para aplicativos de terceiros.

## APK pelo GitHub
Acesse **Actions → Compilar APK FreeFireHelper → execução mais recente → Artifacts → FreeFireHelper-v1.0-debug-apk**. Extraia o ZIP e instale o APK. Se a opção de Actions estiver desligada, habilite-a no GitHub. Também pode compilar no Android Studio com JDK 17 e SDK 35.

## Tecnologias
Android Java, WebView (HTML/CSS/JS), ML Kit Text Recognition, Android TextToSpeech. Min Android 8 (API 26), target Android 14 (API 34).

Os recursos educativos não representam resultados garantidos. Projeto autoral e independente.
