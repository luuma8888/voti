// MIT, qrcode-generator 2.0.4. Embarqué au build, jamais chargé depuis un CDN.
import qrcode from 'qrcode-generator';
qrcode.stringToBytes = text => [...new TextEncoder().encode(text)];
export { qrcode as qrEncoder };
