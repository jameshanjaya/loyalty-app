(function () {
  var path = location.pathname;
  if (path !== "/kartu" && path !== "/hadiah" && path !== "/profil") return;
  var params = new URLSearchParams(location.search);
  var current = params.get("merek") || "";
  try {
    if (current) {
      localStorage.setItem("loyalty-brand", current);
      return;
    }
    var saved = localStorage.getItem("loyalty-brand") || "";
    if (!/^[a-z0-9-]{1,40}$/.test(saved)) return;
    params.set("merek", saved);
    location.replace(path + "?" + params.toString() + location.hash);
  } catch (e) {
    /* private mode */
  }
})();
