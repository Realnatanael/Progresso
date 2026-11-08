/** Comprime a selfie pra caber no POST /api/ninja/avatar. */
export async function encodeSelfie(file, { maxSide = 1024, quality = 0.82 } = {}) {
  if (!file || !file.type?.startsWith('image/')) {
    throw new Error('Escolha uma imagem.');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Falha ao preparar a foto.'))),
      'image/jpeg',
      quality,
    );
  });

  const dataUrl = await blobToDataUrl(blob);
  const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
  return { photoBase64: base64, photoMime: 'image/jpeg' };
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Não foi possível ler a foto.'));
    reader.readAsDataURL(blob);
  });
}
