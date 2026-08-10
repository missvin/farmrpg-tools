import { T300_POSTER_HEIGHT, T300_POSTER_WIDTH } from './T300RacePoster';

export const T300_POSTER_PNG_WIDTH = T300_POSTER_WIDTH * 2;
export const T300_POSTER_PNG_HEIGHT = T300_POSTER_HEIGHT * 2;

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('Unable to embed poster image.'));
    reader.readAsDataURL(blob);
  });
}

export async function serializeT300Poster(svg: SVGSVGElement): Promise<string> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('width', String(T300_POSTER_WIDTH));
  clone.setAttribute('height', String(T300_POSTER_HEIGHT));

  const images = [...clone.querySelectorAll('image')];
  await Promise.all(images.map(async (image) => {
    const href = image.getAttribute('href');
    if (!href || href.startsWith('data:')) return;
    const response = await fetch(href);
    if (!response.ok) throw new Error(`Unable to embed poster asset: ${href}`);
    image.setAttribute('href', await blobToDataUrl(await response.blob()));
  }));

  return new XMLSerializer().serializeToString(clone);
}
