// Canonical Sunmi IWoyouService AIDL — method order MUST match the server-side
// service exactly (woyou.aidlservice.jiuiv5 package on the V2s). AIDL dispatches
// methods by transaction code (= declaration order), so any reordering or
// missing method shifts every later method to the wrong server endpoint and
// causes random behavior such as the printer running its self-check page when
// printText is called.
package woyou.aidlservice.jiuiv5;

import woyou.aidlservice.jiuiv5.ICallback;
import android.graphics.Bitmap;

interface IWoyouService {
    void printerInit(in ICallback callback);                                                                                                  // 1
    void printerSelfChecking(in ICallback callback);                                                                                          // 2
    String getPrinterSerialNo();                                                                                                              // 3
    String getPrinterModal();                                                                                                                 // 4
    String getPrinterVersion();                                                                                                               // 5
    int getPrintedLength();                                                                                                                   // 6
    int getPrinterPaper();                                                                                                                    // 7
    void setPrinterStyle(int key, int value);                                                                                                 // 8
    int getPrinterStatus();                                                                                                                   // 9
    void lineWrap(int n, in ICallback callback);                                                                                              // 10
    void sendRAWData(in byte[] rawData, in ICallback callback);                                                                               // 11
    void setAlignment(int alignment, in ICallback callback);                                                                                  // 12
    void setFontName(String typeface, in ICallback callback);                                                                                 // 13
    void setFontSize(float fontsize, in ICallback callback);                                                                                  // 14
    void printText(String text, in ICallback callback);                                                                                       // 15
    void printTextWithFont(String text, String typeface, float fontsize, in ICallback callback);                                              // 16
    void printOriginalText(String text, in ICallback callback);                                                                               // 17
    void printColumnsText(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, in ICallback callback);                          // 18
    void printColumnsString(in String[] colsTextArr, in int[] colsWidthArr, in int[] colsAlign, in ICallback callback);                        // 19
    void printBitmap(in Bitmap bitmap, in ICallback callback);                                                                                // 20
    void printBitmapCustom(in Bitmap bitmap, int type, in ICallback callback);                                                                // 21
    void printBarCode(String data, int symbology, int height, int width, int textposition, in ICallback callback);                            // 22
    void printQRCode(String data, int modulesize, int errorlevel, in ICallback callback);                                                     // 23
    void cutPaper(in ICallback callback);                                                                                                     // 24
    void enterPrinterBuffer(boolean clean);                                                                                                   // 25
    void commitPrinterBuffer();                                                                                                               // 26
    void exitPrinterBuffer(boolean commit);                                                                                                   // 27
    void printString(String message, in ICallback callback);                                                                                  // 28
    int updatePrinter(int clean, int deepClean);                                                                                              // 29
}
