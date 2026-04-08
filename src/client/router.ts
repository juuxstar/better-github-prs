import { createRouter, createWebHistory } from 'vue-router';

import App from './App.vue';

const router = createRouter({
	history : createWebHistory(),
	routes  : [
		{
			path      : '/',
			component : App,
		},
		{
			path      : '/pull-request/:owner/:repo/:number/:tab?',
			component : () => import('./views/PrDetailView.vue'),
			props     : true,
		},
	],
});

export default router;
