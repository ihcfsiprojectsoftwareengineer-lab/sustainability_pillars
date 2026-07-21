    const SUPABASE_URL = "https://xqxsyqfpkrdowktzyrbo.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_8dijp37gWwgJDYBqpEkq9Q_BO4FMQwR";
    const SUPABASE_TABLE = "sustainability_pillars";
    const SUPABASE_DIRECTORY_TABLE = "sustainability_pi_directory";
  
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const form = document.getElementById("ideaSubmissionForm");
    const messageBox = document.getElementById("formMessage");

    // ── Secret key → Department / PI / Project directory, loaded from Supabase ──
    const departmentSelect = document.getElementById("department");
    const piSelect = document.getElementById("piName");
    const projectTitleInput = document.getElementById("projectTitle");
    const piIdInput = document.getElementById("piId");
    const secretKeyInput = document.getElementById("secretKey");
    const secretKeyStatus = document.getElementById("secretKeyStatus");

    let piDirectory = []; // [{ id, department, pi_name, project_title, secret_key }]

    async function loadDirectory() {
      const { data, error } = await supabaseClient
        .from(SUPABASE_DIRECTORY_TABLE)
        .select("id, department, pi_name, project_title, secret_key")
        .order("department", { ascending: true })
        .order("pi_name", { ascending: true });

      if (error) {
        console.error("Supabase directory load error:", error);
        departmentSelect.value = "";
        departmentSelect.placeholder = "Failed to load list";
        showMessage("error", "Could not load the Department/PI list. Please refresh the page.");
        return;
      }

      piDirectory = data || [];
      resetDirectoryFields("Auto-filled once you enter a valid secret key");
    }

    // Fills the (disabled/readonly) department, PI, and project fields from a matched row
    function applyDirectoryRow(row) {
      departmentSelect.value = row.department || "";
      piSelect.value = row.pi_name || "";
      projectTitleInput.value = row.project_title || "";
      piIdInput.value = row.id;
    }

    function resetDirectoryFields(placeholderText) {
      departmentSelect.value = "";
      departmentSelect.placeholder = placeholderText;
      piSelect.value = "";
      piSelect.placeholder = placeholderText;
      projectTitleInput.value = "";
      piIdInput.value = "";
    }

    function lookupSecretKey() {
      const key = secretKeyInput.value.trim();

      if (!key) {
        resetDirectoryFields("Enter your secret key first");
        secretKeyStatus.textContent = "";
        return;
      }

      const match = piDirectory.find(row => row.secret_key === key);

      if (match) {
        applyDirectoryRow(match);
        secretKeyStatus.textContent = "✓ Secret key verified";
        secretKeyStatus.style.color = "#0f6b4a";
      } else {
        resetDirectoryFields("Secret key not recognized");
        secretKeyStatus.textContent = "✗ Secret key not recognized";
        secretKeyStatus.style.color = "#a82424";
      }
    }

    secretKeyInput.addEventListener("input", lookupSecretKey);

    loadDirectory();

    // ── Pillar allocation: shared config for inputs, chart segments & legend ──
    const PILLARS = [
      { id: "envPct",    key: "env",    seg: "segEnv",    leg: "legEnv",    label: "Environmental" },
      { id: "humPct",    key: "hum",    seg: "segHum",    leg: "legHum",    label: "Human" },
      { id: "culPct",    key: "cul",    seg: "segCul",    leg: "legCul",    label: "Cultural" },
      { id: "socialPct", key: "social", seg: "segSocial", leg: "legSocial", label: "Social" },
      { id: "ecoPct",    key: "eco",    seg: "segEco",    leg: "legEco",    label: "Economic" },
    ];
    const pillarIds = PILLARS.map(p => p.id);

    function getPillarValues() {
      return PILLARS.map(p => Number(document.getElementById(p.id).value) || 0);
    }

    function getFeasibilityTotal() {
      return getPillarValues().reduce((sum, v) => sum + v, 0);
    }

    function validateFeasibility() {
      const total = getFeasibilityTotal();
      const error = document.getElementById("feasibilityError");

      if (total !== 100) {
        error.style.display = "block";
        document.getElementById("envPct").focus();
        return false;
      }

      error.style.display = "none";
      return true;
    }

    // ── Stacked bar chart: redraws segment widths + legend from live inputs ──
    function updatePillarChart(values, total) {
      values.forEach((value, i) => {
        const pillar = PILLARS[i];
        const segment = document.getElementById(pillar.seg);
        const legendValue = document.getElementById(pillar.leg);
        const widthPct = total > 0 ? (value / total) * 100 : 0;

        segment.style.width = widthPct + "%";
        const segLabel = segment.querySelector(".seg-label");
        segLabel.textContent = widthPct >= 10 ? `${pillar.label} ${value}%` : "";
        segment.title = `${pillar.label}: ${value}%`;

        if (legendValue) legendValue.textContent = value + "%";
      });

      const bar = document.getElementById("pillarChartBar");
      if (bar) {
        bar.setAttribute(
          "aria-label",
          "Sustainability pillar allocation: " +
            PILLARS.map((p, i) => `${p.label} ${values[i]}%`).join(", ") +
            ` (total ${total}%)`
        );
      }
    }


    // ── Prevents total from exceeding 100%: clamps only the slider being
    // dragged to whatever budget the other four have left. `max` stays at
    // 100 on every slider so untouched thumbs never visually shift ──
    function restrictSlider(activeId) {
      if (!activeId) return;
        const otherSum = PILLARS
        .filter(p => p.id !== activeId)
        .reduce((sum, p) => sum + (Number(document.getElementById(p.id).value) || 0), 0);
        const maxAllowed = 100 - otherSum;

      const input = document.getElementById(activeId);
        if (Number(input.value) > maxAllowed) {
          input.value = maxAllowed;
        }
    }

    function updateFeasibility() {
      const [env, hum, cul, social, eco] = getPillarValues();
      const total = env + hum + cul + social + eco;

      const display = document.getElementById("totalDisplay");
      const error = document.getElementById("feasibilityError");

      display.textContent = `Total: ${total}%`;
      display.style.color = total === 100 ? "#0f6b4a" : "#a82424";
      error.style.display = (total > 0 && total !== 100) ? "block" : "none";

      document.getElementById("feasibility").value =
        `env-${env},hum-${hum},cul-${cul},social-${social},eco-${eco}`;

      updatePillarChart([env, hum, cul, social, eco], total);
    }

    pillarIds.forEach(id => {
      document.getElementById(id).addEventListener("input", () => {
        restrictSlider(id);
        syncSliderLabels();
        updateFeasibility();
      });
    });


    updateFeasibility();

    function showMessage(type, text) {
      if (!messageBox) return;
      messageBox.className = "alert " + type;
      messageBox.textContent = text;
      messageBox.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    function syncSliderLabels() {
      pillarIds.forEach(id => {
        const valueLabel = document.getElementById(id + "Value");
        if (valueLabel) valueLabel.textContent = document.getElementById(id).value + "%";
      });
    }

    document.getElementById("clearBtn").addEventListener("click", () => {
      form.reset();
      secretKeyInput.value = "";
      secretKeyStatus.textContent = "";
      resetDirectoryFields("Enter your secret key first");
      syncSliderLabels();
      updateFeasibility();
      messageBox.style.display = "none";
    });

    // ── Final submit: validates, then inserts the idea directly into Supabase ──
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!piIdInput.value) {
        showMessage("error", "Please enter a valid Secret Key before submitting.");
        secretKeyInput.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!validateFeasibility()) {
        showMessage("error", "The five sustainability percentages must add up to exactly 100%.");
        document.getElementById("feasibilityError").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      const submitButton = form.querySelector("button[type='submit']");
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
      }

      const [env, hum, cul, social, eco] = getPillarValues();

      const payload = {
        pi_id: Number(piIdInput.value),
        department: departmentSelect.value,
        pi_name: piSelect.value || "",
        project_title: projectTitleInput.value,
        environmental_pct: env,
        human_pct: hum,
        cultural_pct: cul,
        social_pct: social,
        economic_pct: eco,
        feasibility: document.getElementById("feasibility").value,
      };

      try {
        const { data, error } = await supabaseClient
          .from(SUPABASE_TABLE)
          .insert([payload])
          .select()
          .single();

        if (error) throw error;

        const ideaCode = data?.id || "";
        form.reset();
        secretKeyInput.value = "";
        secretKeyStatus.textContent = "";
        resetDirectoryFields("Enter your secret key first");
        syncSliderLabels();
        showMessage("success", "Feedback for Project submitted successfully!" + (ideaCode ? " Your Feedback code: " + ideaCode : ""));
        updateFeasibility();
      } catch (error) {
        const isDuplicate = error?.code === "23505";
        showMessage(
          "error",
          isDuplicate
            ? "You have already submitted a Feedback for the Project. Only one submission per PI is allowed."
            : (error.message || "Submission failed. Please try again.")
        );
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = "Submit Feedback";
        }
      }
    });