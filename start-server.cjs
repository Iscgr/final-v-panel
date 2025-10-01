#!/usr/bin/env node
// اسکریپت اجرای سرور در حالت production

(async () => {
	try {
		// اجرای فایل کامپایل شده
		await import('./dist/server/index.js');
	} catch (err) {
		console.error('Startup error:', err);
		process.exit(1);
	}
})();
