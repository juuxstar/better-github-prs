import './assets/dashboard.css';
import './assets/utilities.css';

import { createApp } from 'vue';

import AppShell                    from './AppShell.vue';
import { initColorScheme }         from './lib/colorScheme';
import { migrateHljsThemeStorage } from './lib/hljsTheme';
import { iconSvg }                 from './lib/icons';
import router                      from './router';

initColorScheme();
migrateHljsThemeStorage();

import AppearanceSelect from './components/AppearanceSelect.vue';
import AppHeader        from './components/AppHeader.vue';
import AuthScreen       from './components/AuthScreen.vue';
import CommentPopover   from './components/CommentPopover.vue';
import CreatePrSection  from './components/CreatePrSection.vue';
import DeviceScreen     from './components/DeviceScreen.vue';
import ErrorScreen      from './components/ErrorScreen.vue';
import LoadingScreen    from './components/LoadingScreen.vue';
import PrBoard          from './components/PrBoard.vue';
import PrColumn         from './components/PrColumn.vue';
import PrItem           from './components/PrItem.vue';
import RateLimitBanner  from './components/RateLimitBanner.vue';
import PrFilesTab       from './views/PrFilesTab.vue';
import PrOverviewTab    from './views/PrOverviewTab.vue';

const app = createApp(AppShell);

app.use(router);
app.config.globalProperties.$icon = iconSvg;

app.component('app-header', AppHeader);
app.component('auth-screen', AuthScreen);
app.component('create-pr-section', CreatePrSection);
app.component('device-screen', DeviceScreen);
app.component('error-screen', ErrorScreen);
app.component('loading-screen', LoadingScreen);
app.component('pr-board', PrBoard);
app.component('pr-column', PrColumn);
app.component('pr-item', PrItem);
app.component('rate-limit-banner', RateLimitBanner);
app.component('pr-overview-tab', PrOverviewTab);
app.component('pr-files-tab', PrFilesTab);
app.component('comment-popover', CommentPopover);
app.component('appearance-select', AppearanceSelect);

app.mount('#app');
