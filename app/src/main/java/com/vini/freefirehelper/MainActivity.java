package com.vini.freefirehelper;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.Intent;
import android.graphics.Bitmap;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Bundle;
import android.speech.tts.TextToSpeech;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Tela nativa isolada: a UI local (assets) chama somente funções previamente definidas.
 * Nenhuma integração com o processo do Free Fire, nem permissões de captura em segundo plano.
 */
public class MainActivity extends Activity {
    private static final int PICK_MEDIA = 73;
    private WebView web;
    private TextToSpeech speech;
    private boolean speechReady = false;
    private String requestedType = "image";
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private TextRecognizer recognizer;

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(0xff070917);
        getWindow().setNavigationBarColor(0xff080c19);

        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
        speech = new TextToSpeech(this, code -> {
            if (code == TextToSpeech.SUCCESS && speech != null) {
                int lang = speech.setLanguage(new Locale("pt", "BR"));
                speech.setSpeechRate(0.96f);
                speechReady = lang != TextToSpeech.LANG_NOT_SUPPORTED &&
                        lang != TextToSpeech.LANG_MISSING_DATA;
            }
        });

        web = new WebView(this);
        web.setBackgroundColor(0xff070917);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true); // Somente assets empacotados com o APK.
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return !url.startsWith("file:///android_asset/");
            }
        });
        web.addJavascriptInterface(new Bridge(), "AndroidCoach");
        setContentView(web);
        web.loadUrl("file:///android_asset/index.html");
    }

    public class Bridge {
        @JavascriptInterface public void speak(String text) {
            if (text == null || text.trim().isEmpty()) return;
            final String message = text.length() > 580 ? text.substring(0, 580) : text;
            runOnUiThread(() -> {
                if (speechReady && speech != null) {
                    speech.speak(message, TextToSpeech.QUEUE_FLUSH, null, "coach_" + System.nanoTime());
                } else {
                    notifyError("A voz pt-BR ainda não está disponível. Instale ou selecione uma voz em Configurações > Conversão de texto em voz.");
                }
            });
        }

        @JavascriptInterface public void stopVoice() {
            runOnUiThread(() -> { if (speech != null) speech.stop(); });
        }

        @JavascriptInterface public void openMedia(String type) {
            runOnUiThread(() -> {
                requestedType = "video".equals(type) ? "video" : "image";
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("video".equals(requestedType) ? "video/*" : "image/*");
                try {
                    startActivityForResult(intent, PICK_MEDIA);
                } catch (Exception e) {
                    notifyError("Não foi possível abrir os arquivos deste aparelho.");
                }
            });
        }

        @JavascriptInterface public void closeApp() {
            runOnUiThread(() -> finish());
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != PICK_MEDIA) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            callJs("window.FFH.onVisionCancelled()");
            return;
        }
        Uri uri = data.getData();
        String type = requestedType;
        callJs("window.FFH.onVisionProgress(" + JSONObject.quote(type) + ")");
        worker.execute(() -> inspect(uri, type));
    }

    private void inspect(Uri uri, String type) {
        try {
            JSONArray snippets = new JSONArray();
            LinkedHashSet<String> detected = new LinkedHashSet<>();
            int frames = 0;
            if ("video".equals(type)) {
                MediaMetadataRetriever media = new MediaMetadataRetriever();
                try {
                    media.setDataSource(this, uri);
                    String msText = media.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
                    long durationMs = msText == null ? 0 : Long.parseLong(msText);
                    if (durationMs <= 0) throw new IllegalArgumentException("Vídeo sem duração válida");
                    double[] percentages = {0.10, 0.35, 0.60, 0.85};
                    for (double fraction : percentages) {
                        Bitmap frame = media.getFrameAtTime((long)(durationMs * fraction * 1000),
                                MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
                        if (frame == null) continue;
                        frames++;
                        recognizeBitmap(frame, detected);
                        frame.recycle();
                    }
                } finally {
                    media.release();
                }
                if (frames == 0) throw new IllegalStateException("Não consegui ler os quadros do vídeo.");
            } else {
                InputImage img = InputImage.fromFilePath(this, uri);
                Text recognized = Tasks.await(recognizer.process(img));
                addText(recognized.getText(), detected);
                frames = 1;
            }
            for (String piece : detected) snippets.put(piece);
            JSONObject result = new JSONObject();
            result.put("kind", type);
            result.put("frames", frames);
            result.put("snippets", snippets);
            result.put("engine", "ML Kit OCR local");
            callJs("window.FFH.onVisionResult(" + result.toString() + ")");
        } catch (Exception error) {
            notifyError("Não consegui analisar esse arquivo. Use um print nítido ou um vídeo salvo no celular. (" +
                    error.getClass().getSimpleName() + ")");
        }
    }

    private void recognizeBitmap(Bitmap image, LinkedHashSet<String> detected) throws Exception {
        int w = image.getWidth();
        int h = image.getHeight();
        Bitmap small = image;
        int limit = 1280;
        if (Math.max(w, h) > limit) {
            float ratio = limit / (float) Math.max(w, h);
            small = Bitmap.createScaledBitmap(image, Math.max(1,(int)(w*ratio)),
                    Math.max(1,(int)(h*ratio)), true);
        }
        try {
            Text recognized = Tasks.await(recognizer.process(InputImage.fromBitmap(small, 0)));
            addText(recognized.getText(), detected);
        } finally {
            if (small != image) small.recycle();
        }
    }

    private void addText(String raw, LinkedHashSet<String> detected) {
        if (raw == null) return;
        String[] lines = raw.split("[\\n\\r]+");
        for (String line : lines) {
            String clean = line.trim().replaceAll("\\s+", " ");
            if (clean.length() >= 2 && clean.length() <= 160 && detected.size() < 70)
                detected.add(clean);
        }
    }

    private void notifyError(String message) {
        callJs("window.FFH.onVisionError(" + JSONObject.quote(message) + ")");
    }

    private void callJs(String script) {
        runOnUiThread(() -> {
            if (web != null) web.evaluateJavascript(script, null);
        });
    }

    @Override public void onBackPressed() {
        if (web != null) web.evaluateJavascript("window.FFH.goBack()", null);
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (speech != null) { speech.stop(); speech.shutdown(); speech = null; }
        if (recognizer != null) recognizer.close();
        worker.shutdownNow();
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
