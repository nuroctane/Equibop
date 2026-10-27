// Equibop updater view.
//
// Loaded as a CLASSIC script (not type="module"): module scripts are fetched in
// CORS mode, and the equibop:// scheme has no effective privileges in the
// packaged app (page origin is "null"), so a module script is blocked outright
// and none of this file would ever run - that is exactly why the buttons were
// dead. A classic script is not subject to that check.
//
// Handlers are attached before anything that can fail, so a missing bridge or a
// failed IPC call can never leave the window unresponsive again.
(async function () {
    "use strict";

    const native = window.VesktopUpdaterNative;

    /** @type {HTMLDialogElement} */
    const updateDialog = document.getElementById("update-dialog");
    /** @type {HTMLDialogElement} */
    const installingDialog = document.getElementById("installing-dialog");
    /** @type {HTMLProgressElement} */
    const downloadProgress = document.getElementById("download-progress");
    /** @type {HTMLElement} */
    const errorText = document.getElementById("error");
    /** @type {HTMLElement} */
    const statusText = document.getElementById("status");

    const errMessage = e => (e && e.message ? e.message : String(e));

    function setStatus(message) {
        if (statusText) statusText.textContent = message || "";
    }

    function showError(message) {
        errorText.textContent = message;
        updateDialog.closedBy = "any";
        if (!updateDialog.open) updateDialog.showModal();
        installingDialog.close();
        updateDialog.classList.remove("hidden");
    }

    // ---- buttons first: nothing below this point can make them dead ----
    document.getElementById("update-button").addEventListener("click", async () => {
        downloadProgress.value = 0;
        errorText.textContent = "";

        if (navigator.platform.startsWith("Linux")) {
            document.getElementById("linux-note").classList.remove("hidden");
        }

        updateDialog.showModal();

        if (!native) {
            showError("Cannot reach the updater service (preload bridge missing). Download the latest release from github.com/Equicord/Equibop/releases.");
            return;
        }

        try {
            await native.installUpdate();
            downloadProgress.value = 100;
            updateDialog.closedBy = "any";
            installingDialog.showModal();
            updateDialog.classList.add("hidden");
        } catch (e) {
            showError(`Could not start the update: ${errMessage(e)}`);
        }
    });

    document.getElementById("later-button").addEventListener("click", async () => {
        if (!native) return;
        try {
            await native.snoozeUpdate();
        } catch (e) {
            setStatus(`Could not snooze the update: ${errMessage(e)}`);
        }
    });

    document.getElementById("ignore-button").addEventListener("click", async () => {
        const confirmed = confirm(
            "Are you sure you want to ignore this update? You will not be notified about this update again. Updates are important for security and stability."
        );
        if (!confirmed || !native) return;
        try {
            await native.ignoreUpdate();
        } catch (e) {
            setStatus(`Could not ignore the update: ${errMessage(e)}`);
        }
    });

    if (native) {
        native.onProgress(percent => (downloadProgress.value = percent));
        native.onError(message => showError(`An error occurred while downloading the update: ${message}`));
    }

    // ---- data: optional, must never block the buttons ----
    function renderReleaseNotes(releaseNotes) {
        const container = document.getElementById("release-notes");
        const indent = html => String(html).replace(/<\/?h([1-3])/g, (m, level) => m.replace(level, Number(level) + 3));

        if (releaseNotes == null) {
            container.innerHTML = '<p class="muted">No release notes were published for this version.</p>';
            return;
        }

        if (typeof releaseNotes === "string") {
            container.innerHTML = `<section><div>${indent(releaseNotes)}</div></section>`;
            return;
        }

        if (Array.isArray(releaseNotes)) {
            container.innerHTML = releaseNotes
                .map(
                    entry => `
            <section>
                <h3>Version ${entry && entry.version != null ? entry.version : "?"}</h3>
                <div>${indent(entry && entry.note != null ? entry.note : "")}</div>
            </section>
        `
                )
                .join("\n");
            return;
        }

        container.textContent = String(releaseNotes);
    }

    if (!native) {
        setStatus(
            "The updater's preload bridge did not load, so this window cannot talk to Equibop. Update manually from github.com/Equicord/Equibop/releases, then report this window's console output."
        );
        return;
    }

    let data;
    try {
        data = await native.getData();
    } catch (e) {
        setStatus(`Could not read the update details: ${errMessage(e)}`);
        return;
    }

    const update = (data && data.update) || {};

    document.getElementById("current-version").textContent = (data && data.version) || "unknown";
    document.getElementById("new-version").textContent = update.version || "unknown";

    try {
        renderReleaseNotes(update.releaseNotes);
    } catch (e) {
        setStatus(`Could not render the release notes: ${errMessage(e)}`);
    }

    document.querySelectorAll("a").forEach(a => {
        a.target = "_blank";
    });

    // remove useless headings
    document.querySelectorAll("h3, h4, h5, h6").forEach(h => {
        if (h.textContent.trim().toLowerCase() === "what's changed") {
            h.remove();
        }
    });
})();
