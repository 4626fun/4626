> ## Documentation Index
> Fetch the complete documentation index at: https://docs.base.org/llms.txt
> Use this file to discover all available pages before exploring further.

# Design Guidelines

> Build a mini app that is intuitive and delightful to use.

### Display

<Card img="https://mintcdn.com/base-a060aa97/uV3xTeqWsv_faIJP/images/miniapps/miniapp-design-spec.png?fit=max&auto=format&n=uV3xTeqWsv_faIJP&q=85&s=6d8aeeaf49876a9ed37420fc101c221f" data-og-width="1280" width="1280" data-og-height="816" height="816" data-path="images/miniapps/miniapp-design-spec.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/base-a060aa97/uV3xTeqWsv_faIJP/images/miniapps/miniapp-design-spec.png?w=280&fit=max&auto=format&n=uV3xTeqWsv_faIJP&q=85&s=4eabe12b23a1e09c5a5f9a9a77dd8a67 280w, https://mintcdn.com/base-a060aa97/uV3xTeqWsv_faIJP/images/miniapps/miniapp-design-spec.png?w=560&fit=max&auto=format&n=uV3xTeqWsv_faIJP&q=85&s=2440bb595213f3df7b1ed8202d6947ae 560w, https://mintcdn.com/base-a060aa97/uV3xTeqWsv_faIJP/images/miniapps/miniapp-design-spec.png?w=840&fit=max&auto=format&n=uV3xTeqWsv_faIJP&q=85&s=68011cab2e96c17d8ccb9d133910daef 840w, https://mintcdn.com/base-a060aa97/uV3xTeqWsv_faIJP/images/miniapps/miniapp-design-spec.png?w=1100&fit=max&auto=format&n=uV3xTeqWsv_faIJP&q=85&s=7160082f8588a8e985f6570fdf3da295 1100w, https://mintcdn.com/base-a060aa97/uV3xTeqWsv_faIJP/images/miniapps/miniapp-design-spec.png?w=1650&fit=max&auto=format&n=uV3xTeqWsv_faIJP&q=85&s=980a56d6499ff2ca21ea2584943ea941 1650w, https://mintcdn.com/base-a060aa97/uV3xTeqWsv_faIJP/images/miniapps/miniapp-design-spec.png?w=2500&fit=max&auto=format&n=uV3xTeqWsv_faIJP&q=85&s=093c56eb7cf2050c21161d0ca05702c9 2500w">
  Your [manifest configuration](/mini-apps/core-concepts/manifest) controls how your app appears across these surfaces. [See full specification](/images/miniapps/miniapp-design-spec.png).
</Card>

### Layout

* Keep core actions visible near the top or middle of the screen — not hidden behind scrolls.
* Limit the number of buttons. Make it obvious what users should do first.
* Use clear primary calls to action (e.g., “Create”, “Start Game”, “Deposit”).
* Design for **small viewports** and **portrait orientation.**
* **Optimize for thumb reach and one-handed use.**

### Navigation

* Most mini apps should include a **bottom navigation bar**.

<img src="https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-tab.png?fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=7733f7ddbc6fb67775ab6fbcf69e09df" alt="Bottom navigation bar example" className="rounded-lg" data-og-width="3771" width="3771" data-og-height="3156" height="3156" data-path="images/design-guidelines/navigation-tab.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-tab.png?w=280&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=41c005cb7c6858f8a341d471aade3bdf 280w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-tab.png?w=560&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=5f975efdcda2baea344aee563feb9889 560w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-tab.png?w=840&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=d17963f1869d09ed8122b6a573cd1cf0 840w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-tab.png?w=1100&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=7dc127ec67178115b4fa806d6f6849ce 1100w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-tab.png?w=1650&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=356eaa0de863ca96c69509d8fc5b6dc1 1650w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-tab.png?w=2500&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=ee54434561b772f3fc5118be94940b73 2500w" />

* A side menu can also be an intuitive place to put settings and user profile information.
  <img src="https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-sidebar.png?fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=1ddb83f7da91205215fb2c7516df53fc" alt="Side navigation menu example" className="rounded-lg" data-og-width="3771" width="3771" data-og-height="3156" height="3156" data-path="images/design-guidelines/navigation-sidebar.png" data-optimize="true" data-opv="3" srcset="https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-sidebar.png?w=280&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=1b879488ee3e53241c6462d78e07742c 280w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-sidebar.png?w=560&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=580900d38855eea42cde15b67ca142bc 560w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-sidebar.png?w=840&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=c9e6914bf42d819e097928c08db7a8c5 840w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-sidebar.png?w=1100&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=eb47a08991ddcf8abd3faef4fd99e95e 1100w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-sidebar.png?w=1650&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=50a35ee53e5322ce376225c01a7bbf2c 1650w, https://mintcdn.com/base-a060aa97/VOYxYmSegXCaAbF5/images/design-guidelines/navigation-sidebar.png?w=2500&fit=max&auto=format&n=VOYxYmSegXCaAbF5&q=85&s=1360ba8e74875e26aa9d2839d6bfdc3b 2500w" />

* Always include **labels under icons** so users understand each tab.

* Test on multiple device sizes to ensure buttons are not cut off.

### Colors

Use color to communicate clearly, express your brand, and create cohesive mini app experiences.

### **Color Palette**

* **Primary:** Brand color for CTAs and key interactions.
* **Secondary:** Complements primary; use for accents or secondary actions.
* **Neutral:** For text, backgrounds, and structure with strong contrast.

### **Themes**

* Support **light and dark modes**:
* Maintain contrast and brand consistency.
* Respect system preference but allow manual toggle.
* Use smooth transitions between themes.
* **💡Tip:** Use **semantic color tokens** (e.g., `--color-primary`, `--color-background`) with **light/dark theme overrides** for maintainability and flexibility.

### Typography

* Ensure the fonts you use are easy to read. Our team recommends **Inter.**
* **Ensure sufficient contrast between text and background colors** to make reading easy under various lighting conditions.
* **Stick to regular, bold, and italic as needed.** Decorative or script fonts should be reserved for accents, not body text.

### Spacing

* Groups related elements together.
* Consistent spacing: Creates visual rhythm and predictability with consistent spacing.
* Give content room to breathe with white space.
* Avoid cramped layouts.
* Base Unit: Start with a base spacing unit (typically **4px** or **8px**) and maintain consistency throughout:
  * 4px base: More granular control, better for mobile.
  * 8px base: Easier mental math, good for desktop.

### Touch Interactions

* Ensure all touch targets are at least **44px**.
* Support common gestures (tap, swipe, pinch) where appropriate.
* Don’t rely on **hover states** — they don’t exist on touch screens.
