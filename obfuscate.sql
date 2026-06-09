UPDATE contacts 
SET whatsapp_number = whatsapp_number || '_dummy' 
WHERE whatsapp_number NOT IN ('082117071800', '6282117071800') 
AND whatsapp_number NOT LIKE '%_dummy';

INSERT INTO contacts (id, whatsapp_number, full_name, source)
SELECT gen_random_uuid(), '6282117071800', 'Test User (Safe)', 'system_obfuscation'
WHERE NOT EXISTS (
    SELECT 1 FROM contacts WHERE whatsapp_number IN ('082117071800', '6282117071800')
);
