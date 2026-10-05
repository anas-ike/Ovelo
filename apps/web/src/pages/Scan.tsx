import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';
import { Field, Input } from '../components/Field';
import { post } from '../lib/api';
import type { BinaryBitmap, DecodeHintType as HintType } from '@zxing/library';
async function createReader() {
  const [{ BrowserMultiFormatReader }, { DecodeHintType, BarcodeFormat }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const hints = new Map<HintType, unknown>([
    [DecodeHintType.TRY_HARDER, true],
    [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE, BarcodeFormat.CODE_128, BarcodeFormat.EAN_13, BarcodeFormat.UPC_A]],
  ]);
  class OveloReader extends BrowserMultiFormatReader {
    private readonly pure = new BrowserMultiFormatReader(new Map([...hints, [DecodeHintType.PURE_BARCODE, true]]));
    override decodeBitmap(bitmap: BinaryBitmap) {
      try { return super.decodeBitmap(bitmap); }
      // Some clean generated labels confuse geometric detection. Read their
      // exact module grid as a fallback; photographed labels still use detection.
      catch { return this.pure.decodeBitmap(bitmap); }
    }
  }
  return new OveloReader(hints);
}
export function Scan() {
  const navigate = useNavigate(); const video = useRef<HTMLVideoElement>(null); const controls = useRef<{ stop: () => void } | undefined>(undefined); const active = useRef(true), resolving = useRef(false), attempt = useRef(0);
  const [code, setCode] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [camera, setCamera] = useState(false);
  const stop = () => { attempt.current++; controls.current?.stop(); controls.current = undefined; const stream = video.current?.srcObject as MediaStream | null; stream?.getTracks().forEach(t => t.stop()); if (video.current) video.current.srcObject = null; setCamera(false); };
  useEffect(() => { active.current = true; const preview = video.current; return () => { active.current = false; attempt.current++; controls.current?.stop(); (preview?.srcObject as MediaStream | null)?.getTracks().forEach(t => t.stop()); }; }, []);
  async function resolve(value: string) { if (resolving.current) return; resolving.current = true; setBusy(true); setError(''); stop(); try { const result = await post<{ data: { itemId: string } }>('/codes/resolve', { code: value }); navigate(`/item/${result.data.itemId}`); } catch (e) { setError(e instanceof Error ? e.message : 'Invalid or expired Ovelo code.'); } finally { setBusy(false); resolving.current = false; } }
  async function start() { const started = ++attempt.current; setError(''); setCamera(true); try {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable');
    const reader = await createReader();
    if (!active.current || started !== attempt.current) return;
    const scanner = await reader.decodeFromConstraints({ video: { facingMode: { ideal: 'environment' } }, audio: false }, video.current!, (result, _error, control) => { if (result && active.current && started === attempt.current) { control.stop(); void resolve(result.getText()); } });
    if (!active.current || started !== attempt.current) scanner.stop(); else controls.current = scanner;
  } catch { if (active.current && started === attempt.current) { stop(); setError('Camera access unavailable. You can enter the code manually or upload an image.'); } } }
  return <div className="form-page"><div className="form-page-head"><div><h2>Scan QR / Barcode</h2><p>Camera frames and selected images are decoded locally in your browser. Only the decoded code is sent to Ovelo.</p></div></div><section className="detail-section records-stack">
    {error && <p className="form-alert" role="alert">{error}</p>}
    <video ref={video} className={`scan-video ${camera ? '' : 'hidden-video'}`} muted playsInline aria-label="Camera scanner preview" />
    <div><Button disabled={busy || camera} onClick={() => void start()}>Scan QR / Barcode</Button>{camera && <Button variant="ghost" onClick={stop}>Stop camera</Button>}</div>
    <p>Supports QR, Code 128, EAN-13 and UPC-A where a readable code is available. Product barcodes resolve only if attached to one of your own items.</p>
    <form className="records-stack" onSubmit={e => { e.preventDefault(); void resolve(code); }}><Field label="Enter code manually"><Input value={code} onChange={e => setCode(e.target.value)} maxLength={2048} required autoComplete="off" /></Field><Button type="submit" disabled={busy || !code.trim()} loading={busy}>Find my item</Button></form>
    <Field label="Upload code image" hint="PNG, JPEG or WEBP, up to 10 MB. The image stays on your device."><Input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; if (file.size > 10 * 1024 * 1024) { setError('Choose an image under 10 MB.'); return; } stop(); setBusy(true); setError(''); void (async () => { const url = URL.createObjectURL(file); try { const reader = await createReader(); const result = await reader.decodeFromImageUrl(url); if (active.current) await resolve(result.getText()); } catch { if (active.current) setError('No readable code found. Try a clearer image or enter the code manually.'); } finally { URL.revokeObjectURL(url); if (active.current) setBusy(false); } })(); }} /></Field>
  </section></div>;
}
