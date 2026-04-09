/* App CSS lives under styles/ (global bundles here; feature-scoped sheets imported from views/components). */
import '../styles/dashboard.css';
import '../styles/utilities.css';

import { createApp } from 'vue';

import { iconSvg }                 from '../lib/icons';
import { initColorScheme }         from '../lib/theme/colorScheme';
import { migrateHljsThemeStorage } from '../lib/theme/hljsTheme';
import AppShell                    from './AppShell.vue';
import router                      from './router';

initColorScheme();
migrateHljsThemeStorage();

import AppearanceSelect from '../components/pr/AppearanceSelect.vue';
import AppHeader        from '../components/pr/AppHeader.vue';
import CommentPopover   from '../components/pr/CommentPopover.vue';
import CreatePrSection  from '../components/pr/CreatePrSection.vue';
import DeviceScreen     from '../components/pr/DeviceScreen.vue';
import PrBoard          from '../components/pr/PrBoard.vue';
import PrColumn         from '../components/pr/PrColumn.vue';
import PrItem           from '../components/pr/PrItem.vue';
import RateLimitBanner  from '../components/pr/RateLimitBanner.vue';
import AuthScreen       from '../components/screens/AuthScreen.vue';
import ErrorScreen      from '../components/screens/ErrorScreen.vue';
import LoadingScreen    from '../components/screens/LoadingScreen.vue';
import PrFilesTab       from '../components/screens/PrFilesTab.vue';
import PrOverviewTab    from '../components/screens/PrOverviewTab.vue';

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
