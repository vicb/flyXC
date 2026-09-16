// Import all used ionic components.

import { initialize } from '@ionic/core/components';
import { defineCustomElement as defineAccordion } from '@ionic/core/components/ion-accordion.js';
import { defineCustomElement as defineAccordionGroup } from '@ionic/core/components/ion-accordion-group.js';
import { defineCustomElement as defineAlert } from '@ionic/core/components/ion-alert.js';
import { defineCustomElement as defineApp } from '@ionic/core/components/ion-app.js';
import { defineCustomElement as defineBackdrop } from '@ionic/core/components/ion-backdrop.js';
import { defineCustomElement as defineBadge } from '@ionic/core/components/ion-badge.js';
import { defineCustomElement as defineButton } from '@ionic/core/components/ion-button.js';
import { defineCustomElement as defineButtons } from '@ionic/core/components/ion-buttons.js';
import { defineCustomElement as defineCard } from '@ionic/core/components/ion-card.js';
import { defineCustomElement as defineCardHeader } from '@ionic/core/components/ion-card-header.js';
import { defineCustomElement as defineCardTitle } from '@ionic/core/components/ion-card-title.js';
import { defineCustomElement as defineCheckbox } from '@ionic/core/components/ion-checkbox.js';
import { defineCustomElement as defineCol } from '@ionic/core/components/ion-col.js';
import { defineCustomElement as defineContent } from '@ionic/core/components/ion-content.js';
import { defineCustomElement as defineFabButton } from '@ionic/core/components/ion-fab-button.js';
import { defineCustomElement as defineFooter } from '@ionic/core/components/ion-footer.js';
import { defineCustomElement as defineGrid } from '@ionic/core/components/ion-grid.js';
import { defineCustomElement as defineHeader } from '@ionic/core/components/ion-header.js';
import { defineCustomElement as defineInput } from '@ionic/core/components/ion-input.js';
import { defineCustomElement as defineItem } from '@ionic/core/components/ion-item.js';
import { defineCustomElement as defineItemDivider } from '@ionic/core/components/ion-item-divider.js';
import { defineCustomElement as defineLabel } from '@ionic/core/components/ion-label.js';
import { defineCustomElement as defineList } from '@ionic/core/components/ion-list.js';
import { defineCustomElement as defineMenu } from '@ionic/core/components/ion-menu.js';
import { defineCustomElement as defineMenuButton } from '@ionic/core/components/ion-menu-button.js';
import { defineCustomElement as defineMenuToggle } from '@ionic/core/components/ion-menu-toggle.js';
import { defineCustomElement as defineModal } from '@ionic/core/components/ion-modal.js';
import { defineCustomElement as defineNote } from '@ionic/core/components/ion-note.js';
import { defineCustomElement as definePopover } from '@ionic/core/components/ion-popover.js';
import { defineCustomElement as defineProgressBar } from '@ionic/core/components/ion-progress-bar.js';
import { defineCustomElement as defineRadio } from '@ionic/core/components/ion-radio.js';
import { defineCustomElement as defineRadioGroup } from '@ionic/core/components/ion-radio-group.js';
import { defineCustomElement as defineRange } from '@ionic/core/components/ion-range.js';
import { defineCustomElement as defineRippleEffect } from '@ionic/core/components/ion-ripple-effect.js';
import { defineCustomElement as defineRoute } from '@ionic/core/components/ion-route.js';
import { defineCustomElement as defineRouterOutlet } from '@ionic/core/components/ion-router-outlet.js';
import { defineCustomElement as defineRow } from '@ionic/core/components/ion-row.js';
import { defineCustomElement as defineSearchbar } from '@ionic/core/components/ion-searchbar.js';
import { defineCustomElement as defineSegment } from '@ionic/core/components/ion-segment.js';
import { defineCustomElement as defineSegmentButton } from '@ionic/core/components/ion-segment-button.js';
import { defineCustomElement as defineSelect } from '@ionic/core/components/ion-select.js';
import { defineCustomElement as defineSelectOption } from '@ionic/core/components/ion-select-option.js';
import { defineCustomElement as defineSelectPopover } from '@ionic/core/components/ion-select-popover.js';
import { defineCustomElement as defineSplitPane } from '@ionic/core/components/ion-split-pane.js';
import { defineCustomElement as defineText } from '@ionic/core/components/ion-text.js';
import { defineCustomElement as defineTitle } from '@ionic/core/components/ion-title.js';
import { defineCustomElement as defineToast } from '@ionic/core/components/ion-toast.js';
import { defineCustomElement as defineToggle } from '@ionic/core/components/ion-toggle.js';
import { defineCustomElement as defineToolbar } from '@ionic/core/components/ion-toolbar.js';

import { defineCustomElement as defineRouter } from './ion-router';

// Note: defineHeader in ion-header.js is named defineHeader (or defineCustomElement)
const customElements = [
  defineAccordion,
  defineAccordionGroup,
  defineAlert,
  defineApp,
  defineBackdrop,
  defineBadge,
  defineButton,
  defineButtons,
  defineCard,
  defineCardHeader,
  defineCardTitle,
  defineCheckbox,
  defineCol,
  defineContent,
  defineFabButton,
  defineFooter,
  defineGrid,
  defineHeader,
  defineInput,
  defineItem,
  defineItemDivider,
  defineLabel,
  defineList,
  defineMenu,
  defineMenuButton,
  defineMenuToggle,
  defineModal,
  defineNote,
  definePopover,
  defineProgressBar,
  defineRadio,
  defineRadioGroup,
  defineRange,
  defineRippleEffect,
  defineRoute,
  defineRouterOutlet,
  defineRow,
  defineSearchbar,
  defineSegment,
  defineSegmentButton,
  defineSelect,
  defineSelectOption,
  defineSelectPopover,
  defineSplitPane,
  defineText,
  defineTitle,
  defineToast,
  defineToggle,
  defineToolbar,
  defineRouter,
];

export function ionicInit(): void {
  initialize();
  for (const define of customElements) {
    define();
  }
}
