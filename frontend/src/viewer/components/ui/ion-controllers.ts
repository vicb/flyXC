// ionic controllers.
//
// They are patched on window in index.html.

import type { alertController, menuController, modalController, toastController } from '@ionic/core';

declare global {
  interface Window {
    menuController: typeof menuController;
    alertController: typeof alertController;
    modalController: typeof modalController;
    toastController: typeof toastController;
  }
}

export function getMenuController(): typeof menuController {
  return window.menuController;
}

export function getModalController(): typeof modalController {
  return window.modalController;
}

export function getAlertController(): typeof alertController {
  return window.alertController;
}

export function getToastController(): typeof toastController {
  return window.toastController;
}
