import { createClient } from '@supabase/supabase-js';
import cloudinary from 'cloudinary';

const SUPABASE_URL      = 'https://opuajgosgqdzpfkrmvqd.supabase.co';
const SUPABASE_SERVICE  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wdWFqZ29zZ3FkenBma3JtdnFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTA0MzUyMiwiZXhwIjoyMDk0NjE5NTIyfQ.U0NReiqYhvnMto8_jmQFeAafXicFodjEEN9LbSDZML4';
const CLOUDINARY_CLOUD  = 'dsf7ikhrx';
const CLOUDINARY_KEY    = '486696538195865';
const CLOUDINARY_SECRET = '91x3_CPe2BRvCkemg_Ji-GVwWTM';
const UPLOAD_FOLDER     = 'optica/armazones';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE);
cloudinary.v2.config({ cloud_name: CLOUDINARY_CLOUD, api_key: CLOUDINARY_KEY, api_secret: CLOUDINARY_SECRET });

async function main() {
  console.log('Leyendo armazones con fotos base64...');
  const { data, error } = await supabase.from('armazones').select('id, nombre, foto_url').like('foto_url', 'data:image%');
  if (error) { console.error('Error:', error.message); process.exit(1); }
  console.log(`Total a migrar: ${data.length}`);
  let ok = 0, fail = 0;
  for (let i = 0; i < data.length; i++) {
    const { id, nombre, foto_url } = data[i];
    try {
      const result = await cloudinary.v2.uploader.upload(foto_url, { folder: UPLOAD_FOLDER, public_id: `armazon_${id}`, overwrite: true, resource_type: 'image' });
      const { error: upErr } = await supabase.from('armazones').update({ foto_url: result.secure_url }).eq('id', id);
      if (upErr) throw new Error(upErr.message);
      ok++;
      console.log(`OK [${i+1}/${data.length}] ${nombre}`);
    } catch (e) {
      fail++;
      console.error(`FAIL [${i+1}/${data.length}] ${nombre}: ${e.message}`);
    }
    if ((i + 1) % 10 === 0) await new Promise(r => setTimeout(r, 500));
  }
  console.log(`Completado: ${ok} exitosas, ${fail} fallidas`);
}

main();
