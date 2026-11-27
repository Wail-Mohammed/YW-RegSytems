# Framework role and mobile verification

## Angular and TypeScript

The browser interface is an Angular 22 application compiled from TypeScript 6. The production server serves its generated files from dist/frontend/browser. It does not merely load Angular beside the old JavaScript interface.

AppComponent renders the seven application views and manages navigation, filters, loading/errors, and notifications with Angular signals. ApiService is injected through Angular dependency injection and uses HttpClient with typed response models. RecordDialogComponent builds reactive forms, validates fields, switches final-grade controls with registration status, and emits save/cancel/edit events. Angular templates interpolate record values safely. The fixed icon component uses only a local allowlist of static SVG paths.

Express remains the backend framework for API routing and static hosting. Repository and DAO retain the class's SQL/MySQL work. The Angular change introduces no new database entities or relationship constraints.

The report describes these concrete framework uses for the optional framework criterion. It does not guarantee a particular extra-credit award.

## Mobile evidence

Responsive styles support narrow layouts, horizontal navigation, internally scrolling tables, modal forms, and larger touch targets. Browser automation uses Chrome's 390px viewport and checks forms, Cancel, navigation, and overflow. That is an emulated viewport, not a real phone test.

Before claiming the professor's mobile bonus, use an actual iPhone or Android. Record the device and browser, then demonstrate a search, insert/update, validation failure, Cancel, joined results, and the report. Check touch interaction and persistence after reload. Put the observed device/browser and limitations in docs/verification.json and show the device operation in the demonstration.

The app binds to 127.0.0.1 by default. A phone cannot reach the computer through its own localhost. For a trusted local-network demonstration, configure HOST=0.0.0.0 and open the computer's local-network address from the phone; return to loopback afterward. Do not expose this unauthenticated registrar demonstration to the public internet.

## Build requirements

Angular 22 requires compatible Node and TypeScript versions. This project uses the Node 24 line (.nvmrc) and pins TypeScript 6.0.x; package-lock.json records resolved packages. See https://angular.dev/reference/versions. The backend alone is JavaScript; Java, Play, and Spring Boot are not used.
