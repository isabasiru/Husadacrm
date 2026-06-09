UPDATE contacts SET whatsapp_number = REPLACE(whatsapp_number, '_dummy', '') WHERE whatsapp_number LIKE '%_dummy';
