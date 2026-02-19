const config = {
  // Update this after Netlify deploy (example: "https://sar-forum-app.netlify.app")
  // This is used to display the link under the QR code on the Install page.
  siteUrl: "",

  stations: {
    primary: "8638863",   // HRBT / CBBT area reference
    secondary: "8638610"  // Sewells Point (backup)
  },

  buoyFallback: "44014",

  forms: {
    tf1: "#",
    tf2: "#",
    tf3: "#",
    tf4: "#",
    admin: "#"
  }
};
