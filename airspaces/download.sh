#! /usr/bin/env sh

# US Class E2 from soaringdata.info
# Update the URL from http://soaringdata.info
wget -O asp/US-classE.txt "http://soaringdata.info/aviation/countHits.php?count=oaECount&file=allusa-E.v21.02-25.2.txt"

# OpenAIP 
OPENAIP_ID=customer_export_H37fIwo29fkMgTeu28dn2do2mc
wget -P asp -r -np --no-verbose https://www.openaip.net/$OPENAIP_ID/

# Ukraine
wget -P asp "http://ifly.dp.ua/download/airspace/UKRAINE%20(UK).zip"
unzip "asp/UKRAINE (UK).zip" -d asp/