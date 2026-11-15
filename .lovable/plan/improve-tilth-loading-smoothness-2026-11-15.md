# Improve Tilth loading smoothness

## Goal
Reduce the JavaScript needed on the first screen without changing the app’s features, stored data, or appearance.

## Plan
1. Isolate the Insights page into TanStack’s route-lazy module so its charting library is downloaded only when Insights is opened.
2. Keep route metadata and navigation behavior unchanged, following the existing TanStack route conventions.
3. Verify the production output separates the Insights/chart code from the initial app bundle, run the relevant tests, and check the preview/build signals.

## Notes
Recent visitor data is sparse (the homepage has only 6–7 readings per metric in the last week), so it cannot establish a reliable sitewide speed baseline. Reported homepage LCP p75 was about 2.95 seconds and TTFB p75 about 1.15 seconds; other pages have too few readings to rank.
