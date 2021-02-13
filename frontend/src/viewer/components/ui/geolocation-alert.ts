import { getAlertController } from './ion-controllers';

export async function showGeolocationDisabledAlert(): Promise<void> {
  const alert = await getAlertController().create({
    header: 'Geolocation error',
    message: 'Give FlyXC permission to access your location to center the map on your current location.',
    buttons: [
      {
        text: 'Ok',
        role: 'cancel',
      },
    ],
  });
  await alert.present();
  setTimeout(() => alert.dismiss(), 5000);
}
