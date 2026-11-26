// Ленивое чтение zip-архива: в памяти только оглавление (имя → где лежит), сами файлы читаются с диска по запросу.
// adm-zip держит в памяти весь архив и объект на каждую запись: ресурс-паки на сотни мегабайт и десятки тысяч
// файлов занимали так почти гигабайт. Здесь на запись — короткая строка имени и три числа.
// Поддерживаются способы сжатия «без сжатия» (0) и deflate (8) — других в zip-архивах паков и NEU не бывает. ZIP64 тоже.
import fs from 'node:fs';
import { inflateRawSync } from 'node:zlib';

const EOCD = 0x06054b50, EOCD64 = 0x06064b50, EOCD64_LOC = 0x07064b50, CEN = 0x02014b50, LOC = 0x04034b50;

function readAt(fd, pos, len) {
  const buf = Buffer.allocUnsafe(len);
  let got = 0;
  while (got < len) {
    const n = fs.readSync(fd, buf, got, len - got, pos + got);
    if (!n) break;
    got += n;
  }
  return got === len ? buf : buf.subarray(0, got);
}

/** Найти конец оглавления: последние 64 КБ + 22 байта файла. */
function findDirectory(fd, size) {
  const tailLen = Math.min(size, 65_557);
  const tail = readAt(fd, size - tailLen, tailLen);
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) !== EOCD) continue;
    let count = tail.readUInt16LE(i + 10);
    let dirSize = tail.readUInt32LE(i + 12);
    let dirOffset = tail.readUInt32LE(i + 16);
    // ZIP64: указатель лежит прямо перед обычным концом оглавления
    if ((count === 0xffff || dirSize === 0xffffffff || dirOffset === 0xffffffff) && i >= 20 && tail.readUInt32LE(i - 20) === EOCD64_LOC) {
      const at = Number(tail.readBigUInt64LE(i - 20 + 8));
      const rec = readAt(fd, at, 56);
      if (rec.readUInt32LE(0) === EOCD64) {
        count = Number(rec.readBigUInt64LE(32));
        dirSize = Number(rec.readBigUInt64LE(40));
        dirOffset = Number(rec.readBigUInt64LE(48));
      }
    }
    return { count, dirSize, dirOffset };
  }
  throw new Error('это не zip-архив (нет оглавления)');
}

/**
 * Открыть архив. Возвращает { names(), entries: Map<имя, запись>, read(запись) → Buffer, close() }.
 * Файл остаётся открытым (один дескриптор), пока не вызван close(). key — как превратить имя в ключ (паки ищут без учёта регистра).
 */
export function openZip(file, { key = s => s } = {}) {
  const fd = fs.openSync(file, 'r');
  try {
    const size = fs.fstatSync(fd).size;
    const { dirSize, dirOffset } = findDirectory(fd, size);
    const dir = readAt(fd, dirOffset, dirSize);
    const entries = new Map();
    let p = 0;
    while (p + 46 <= dir.length && dir.readUInt32LE(p) === CEN) {
      const flags = dir.readUInt16LE(p + 8);
      const method = dir.readUInt16LE(p + 10);
      let csize = dir.readUInt32LE(p + 20);
      let usize = dir.readUInt32LE(p + 24);
      const nameLen = dir.readUInt16LE(p + 28), extraLen = dir.readUInt16LE(p + 30), commentLen = dir.readUInt16LE(p + 32);
      let offset = dir.readUInt32LE(p + 42);
      const name = dir.toString(flags & 0x800 ? 'utf8' : 'latin1', p + 46, p + 46 + nameLen);
      if (usize === 0xffffffff || csize === 0xffffffff || offset === 0xffffffff) {
        // Дополнительное поле ZIP64 (id 0x0001): по порядку только те значения, что в основной записи равны 0xffffffff
        let e = p + 46 + nameLen;
        const end = e + extraLen;
        while (e + 4 <= end) {
          const id = dir.readUInt16LE(e), len = dir.readUInt16LE(e + 2);
          if (id === 1) {
            let q = e + 4;
            if (usize === 0xffffffff) { usize = Number(dir.readBigUInt64LE(q)); q += 8; }
            if (csize === 0xffffffff) { csize = Number(dir.readBigUInt64LE(q)); q += 8; }
            if (offset === 0xffffffff) { offset = Number(dir.readBigUInt64LE(q)); }
            break;
          }
          e += 4 + len;
        }
      }
      if (!name.endsWith('/')) entries.set(key(name), { offset, csize, usize, method });
      p += 46 + nameLen + extraLen + commentLen;
    }
    let closed = false;
    return {
      file,
      entries,
      names: () => entries.keys(),
      /** Содержимое записи (Buffer) или null, если запись повреждена / сжата неизвестным способом. */
      read(entry) {
        if (closed || !entry) return null;
        const head = readAt(fd, entry.offset, 30);
        if (head.length < 30 || head.readUInt32LE(0) !== LOC) return null;
        const start = entry.offset + 30 + head.readUInt16LE(26) + head.readUInt16LE(28);
        const data = readAt(fd, start, entry.csize);
        if (entry.method === 0) return data;
        if (entry.method === 8) { try { return inflateRawSync(data); } catch { return null; } }
        return null;
      },
      close() { if (!closed) { closed = true; try { fs.closeSync(fd); } catch { /* уже закрыт */ } } },
    };
  } catch (e) {
    fs.closeSync(fd);
    throw e;
  }
}
