# Release history

## 4.1.11 - Feb 20, 2025

- Sync with the latest windy API

## 4.1.9 - Feb 16, 2025

- Lower max altitude when zoomed in to ~5200m

## 4.1.8 - Oct 4, 2024

- Drop `@windy.com/devtools` (use a local copy of the types)
- Remember last used location and model

## 4.1.7 - Sep 14, 2024

- Update the list of supported models to exclude AROME-HD

## 4.1.6 - Aug 26, 2024

- Fix the required update check
- Add the HDPRS model
- Display actual model name

## 4.1.5 - Aug 22, 2024

- Add support for the ALADIN model

## 4.1.4 - Aug 01, 2024

- Keep the current model when opening the plugin

## 4.1.3 - July 22, 2024

- Fix center map when a favorite is selected on mobile

## 4.1.2 - Jul 19, 2024

- Prevent an infinite loop when height === 0
- Better handling of burst of wheel events
- Refresh windy data cache on re-render

## 4.1.1 - July 17, 2024

- Do not throw when remote config can not be loaded

## 4.1.0 - July 17, 2024

- Fix startup location and model
- Change plugin internal name (top `windy-plugin-fxc-soundings`)
- Fix a crash when data loaded in error

## 4.0.0 - July 15, 2024

- Fix an error when data is not loaded

## 4.0.0-beta.1 - July 13, 2024

- Split the state into multiple slices
- Check for update
- Perf improvements

## 4.0.0-alpha.2 - July 10, 2024

- Fix elevation steps in ft (3000ft)
- Change cursor values based on the cursor position
- Do not remove the cursor on mobiles
- Display coordinates for unknown places
- Show a message when there are no favorites on mobiles

## 4.0.0-alpha.1 - July 9, 2024

- Migrate code to RTK
- UX improvement on both desktop and mobile layouts
- Simplify the code

## 3.1.0 - June 21, 2024

- Move the repo to github.com/vicb/flyxc
- Fix an issue getting extended forecasts for premium users (following a windy API change)
- Renamed the plugin to "flyXC Soundings"

## 3.0.6 - May 1, 2024

- Added support for aromeReunion and aromeAntilles

## 3.0.0 - Apr 11, 2024

- Update for windy v42

## 2.0.0 - Jun 5, 2023

- Update to windy v39

## 1.4.3 - Jan 16, 2021

- Add support for mobiles & tablets
  You have to visit `https://www.windy.com/plugins/windy-plugin-sounding`.
  Plugins do not work with the installed mobile app.

## 1.3.0 - Oct 21 2020

- Use premium forecasts for registered users.

## 1.2.2 - Oct 15 2020

- fix model update intervals for premium members.

## 1.2.0 - Oct 14 2020

- Re-enable cloud cover,
- Redux code cleanup.

## 1.1.8 - Sep 30 2020

- Disable cloud cover after [build change](https://community.windy.com/topic/7523/load-our-meteorological-data-into-your-windy-plugin/10).

## 1.1.5 - Nov 1 2019

- Display temperatures when the mouse enters the skewt diagram.

## 1.1.0 - Oct 25 2019

- Display wind speed when the mouse enters the windgram.

## 1.0.0 - Sep 13 2019

- Works even after opened after the built-in sounding plugin

## 0.7.5 - April 14 2019

- Change the location when the picker is opened and moved,
- Update wind and altitude scales on each time change.

## 0.7.2 - April 7 2019

- Derives the max temp on the graph from the actual max temp.

## 0.7.1 - April 6 2019

- Add thermal top label,
- Improve styles,
- Display thermals from 2h after sunrise to 2h before sunset.

## 0.7.0 - April 5 2019

- Better axis labels,
- Drop d3,
- Fix a few issues with imperial units.

## 0.6.0 - April 4 2019

- Add convective layer

## 0.5.0 - March 27 2019

- Add cloud cover (data source = windy meteograms)

## 0.4.2 - March 12 2019

- Fix the color of labels.
- Fix left pane styles.

## 0.4.1 - March 12 2019

- Add support for changing timestamp via mouse wheel events.
- Move inline styles to `plugin.less`.
- Open the plugin to the left side.
