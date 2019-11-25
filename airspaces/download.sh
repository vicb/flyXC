#! /usr/bin/env sh

OPENAIP_ID=customer_export_H37fIwo29fkMgTeu28dn2do2mc
wget -P asp -r -np --no-verbose https://www.openaip.net/$OPENAIP_ID/
wget -P asp "http://ifly.dp.ua/download/airspace/UKRAINE%20(UK).zip"
unzip "asp/UKRAINE (UK).zip" -d asp/