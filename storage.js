
    /** Get a JSON value from localStorage under app namespace. */
    function getFromLocalStorage(key, defaultValue) {
        try {
            const raw = localStorage.getItem(storagePrefix + key);
            if (!raw) return defaultValue; // Kalau null langsung return default
            return JSON.parse(raw);
        } catch (e) {
            console.error("Gagal parse localStorage:", e);
            return defaultValue;
        }
    }

    /** Save a JSON value to localStorage under app namespace. */
    function saveToLocalStorage(key, value) {
        try {
            localStorage.setItem(storagePrefix + key, JSON.stringify(value));
        } catch (error) {
            // Tambahkan log untuk memverifikasi jenis error
            console.error("Error saat menyimpan data:", error);

            if (error.name === "QuotaExceededError") {
                // Tambahkan pengecekan ruang yang tersedia sebelum menyimpan
                let usedSpace = new Blob(Object.values(localStorage)).size;
                let totalSpace = 5 * 1024 * 1024; // Biasanya 5MB
                console.error(`Used space: ${usedSpace} bytes / Total allowed: ${totalSpace} bytes`);

                toastr.error("MEMORY BROWSER PENUH!!! Sisa ruang tidak mencukupi.");
            } else {
                toastr.error("Terjadi kesalahan tak terduga saat menyimpan data.");
            }
        }
    }

    /** Remove a key under app namespace from localStorage. */
    function removeFromLocalStorage(key) {
        localStorage.removeItem(storagePrefix + key);
    }

   // ============================
    // DOWNLOAD CSV
    // ============================
    function getActiveTokenKeyLocal() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const raw = (params.get('chain') || '').toLowerCase();
            if (!raw || raw === 'all') return 'TOKEN_MULTICHAIN';
            return `TOKEN_${String(raw).toUpperCase()}`;
        } catch(_) { return 'TOKEN_MULTICHAIN'; }
    }

    function getActiveChainLabel() {
        try {
            const params = new URLSearchParams(window.location.search || '');
            const raw = (params.get('chain') || 'all').toLowerCase();
            return (!raw || raw === 'all') ? 'MULTICHAIN' : raw.toUpperCase();
        } catch(_) { return 'MULTICHAIN'; }
    }

    function downloadTokenScannerCSV() {
        const tokenData = getFromLocalStorage(getActiveTokenKeyLocal(), []);
        const chainLabel = getActiveChainLabel();

        // Header sesuai struktur
        const headers = [
            "id","no","symbol_in","symbol_out","chain",
            "sc_in","des_in","sc_out","des_out",
            "dataCexs","dataDexs","status","selectedCexs","selectedDexs"
        ];

        // Konversi setiap item
        const rows = tokenData.map(token => [
            token.id ?? "",
            token.no ?? "",
            token.symbol_in ?? "",
            token.symbol_out ?? "",
            token.chain ?? "",
            token.sc_in ?? "",
            token.des_in ?? "",
            token.sc_out ?? "",
            token.des_out ?? "",
            JSON.stringify(token.dataCexs ?? {}),    // object → JSON string
            JSON.stringify(token.dataDexs ?? {}),
            token.status ? "true" : "false",         // boolean → string
            (token.selectedCexs ?? []).join("|"),    // array → A|B|C
            (token.selectedDexs ?? []).join("|")
        ].map(v => `"${String(v).replace(/"/g, '""')}"`)); // escape CSV

        // Gabungkan jadi CSV
        const csvContent = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");

        // Buat file download
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `KOIN_MULTISCANNER_${chainLabel}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setLastAction(`EXPORT DATA KOIN [${chainLabel}]`);
    }

    // ============================
    // UPLOAD CSV
    // ============================
    function uploadTokenScannerCSV(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const csvText = e.target.result.trim();
                const rows = csvText.split("\n");

                // Ambil header
                const headers = rows[0].split(",").map(h => h.trim());

                // Parse tiap baris → object
                const tokenData = rows.slice(1).map(row => {
                    // Split CSV aman, mempertahankan koma dalam tanda kutip
                    const values = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

                    let obj = {};
                    headers.forEach((header, index) => {
                        let val = values[index] ? values[index].trim() : "";

                        // Hapus tanda kutip luar & ganti "" jadi "
                        if (val.startsWith('"') && val.endsWith('"')) {
                            val = val.slice(1, -1).replace(/""/g, '"');
                        }

                        // Parsing field sesuai tipe
                        if (header === "dataCexs" || header === "dataDexs") {
                            try { val = JSON.parse(val || "{}"); } catch { val = {}; }
                        }
                        else if (header === "selectedCexs" || header === "selectedDexs") {
                            val = val ? val.split("|") : [];
                        }
                        else if (header === "no" || header === "des_in" || header === "des_out") {
                            val = val ? Number(val) : null;
                        }
                        else if (header === "status") {
                            val = (val || "").toString().trim().toLowerCase() === "true";
                        }

                        obj[header] = val;
                    });

                    return obj;
                });

                // Simpan ke localStorage
                const chainLabel = getActiveChainLabel();
                saveToLocalStorage(getActiveTokenKeyLocal(), tokenData);
                // Hitung jumlah token yang diimport
                let jumlahToken = Array.isArray(tokenData) ? tokenData.length : 0;

                // Tampilkan alert dengan Unicode
                alert(`✅ BERHASIL IMPORT ${jumlahToken} TOKEN 📦`);
                setLastAction(`IMPORT DATA KOIN [${chainLabel}]`);
                location.reload();

            } catch (error) {
                console.error("Error parsing CSV:", error);
                toastr.error("Format file CSV tidak valid!");
            }
        };
        reader.readAsText(file);
    }
