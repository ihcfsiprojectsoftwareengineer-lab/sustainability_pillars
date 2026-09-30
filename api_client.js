    const SUPABASE_URL = "https://xqxsyqfpkrdowktzyrbo.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_8dijp37gWwgJDYBqpEkq9Q_BO4FMQwR";
    const SUPABASE_TABLE = "sustainability_pillars";
    const SUPABASE_DIRECTORY_TABLE = "sustainability_pi_directory";
  
    const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const form = document.getElementById("ideaSubmissionForm");
    const messageBox = document.getElementById("formMessage");

// ── Unique Code → Department / PI / Project, verified server-side via RPC ──
    const departmentSelect = document.getElementById("department");
    const piSelect = document.getElementById("piName");
    const projectTitleInput = document.getElementById("projectTitle");
    const piIdInput = document.getElementById("piId");
    const secretKeyInput = document.getElementById("secretKey");
    const secretKeyStatus = document.getElementById("secretKeyStatus");

    // ── Optional description with 250-word limit ──
const MAX_DESC_WORDS = 250;
const proposalDescInput = document.getElementById("proposalDesc");
const proposalDescCount = document.getElementById("proposalDescCount");

function countWords(text) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function updateDescCount() {
  let words = countWords(proposalDescInput.value);

  // Also catches pasted text: cut down to the first 250 words
  if (words > MAX_DESC_WORDS) {
    proposalDescInput.value = proposalDescInput.value
      .trim()
      .split(/\s+/)
      .slice(0, MAX_DESC_WORDS)
      .join(" ");
    words = MAX_DESC_WORDS;
  }

  proposalDescCount.textContent = `${words} / ${MAX_DESC_WORDS} words`;
  proposalDescCount.style.color = words >= MAX_DESC_WORDS ? "#a82424" : "";
}

proposalDescInput.addEventListener("input", updateDescCount);

// Fills the (readonly) department, PI, and project fields from a matched row
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

let lookupTimer = null;
let lookupSeq = 0;

// Cancels any pending or in-flight lookup so a late response can't refill the form
function cancelLookup() {
  clearTimeout(lookupTimer);
  lookupSeq++;
}

    function lookupSecretKey() {
  cancelLookup();
      const key = secretKeyInput.value.trim();
  const seq = lookupSeq;

      if (!key) {
        resetDirectoryFields("Enter your Unique Code first");
        secretKeyStatus.textContent = "";
        return;
      }

  // Clear immediately so a previously verified PI can't be submitted while typing
  resetDirectoryFields("Checking Unique Code...");
  secretKeyStatus.textContent = "Checking...";
  secretKeyStatus.style.color = "";

  lookupTimer = setTimeout(async () => {
    const { data, error } = await supabaseClient.rpc("lookup_pi_by_code", { p_code: key });

    if (seq !== lookupSeq) return; // a newer keystroke or a Clear superseded this lookup

    if (error) {
      console.error("Unique Code lookup error:", error);
      resetDirectoryFields("Could not verify Unique Code");
      secretKeyStatus.textContent = "Could not verify the code. Please try again.";
      secretKeyStatus.style.color = "#a82424";
      return;
    }

    const match = data && data[0];

      if (match) {
        applyDirectoryRow(match);
        secretKeyStatus.textContent = "✓ Unique Code verified";
        secretKeyStatus.style.color = "#0f6b4a";
      } else {
        resetDirectoryFields("Unique Code not recognized");
        secretKeyStatus.textContent = "✗ Unique Code not recognized";
        secretKeyStatus.style.color = "#a82424";
      }
  }, 400);
    }

    secretKeyInput.addEventListener("input", lookupSecretKey);

resetDirectoryFields("Auto-filled once you enter a valid Unique Code");

    // ── Pillar allocation: shared config for inputs, chart segments & legend ──
    const PILLARS = [
      { id: "envPct",    key: "env",    seg: "segEnv",    leg: "legEnv",    label: "Environmental" },
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
// dragged to whatever budget the other two have left. `max` stays at
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
      const [env, social, eco] = getPillarValues();
      const total = env + social + eco;

      const display = document.getElementById("totalDisplay");
      const error = document.getElementById("feasibilityError");

      display.textContent = `Total: ${total}%`;
      display.style.color = total === 100 ? "#0f6b4a" : "#a82424";
      error.style.display = (total > 0 && total !== 100) ? "block" : "none";

      document.getElementById("feasibility").value =
        `env-${env},social-${social},eco-${eco}`;

      updatePillarChart([env, social, eco], total);
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
  cancelLookup();
      form.reset();
      updateDescCount();
      secretKeyInput.value = "";
      secretKeyStatus.textContent = "";
      resetDirectoryFields("Enter your Unique Code first");
      syncSliderLabels();
      updateFeasibility();
  // Let the CSS (.alert { display: none }) hide it, so later messages can still show
  messageBox.className = "alert";
  messageBox.textContent = "";
    });

// ── Final submit: validates, then inserts the feedback directly into Supabase ──
    form.addEventListener("submit", async function (e) {
      e.preventDefault();

      if (!piIdInput.value) {
        showMessage("error", "Please enter a valid Unique Code before submitting.");
        secretKeyInput.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (!validateFeasibility()) {
    showMessage("error", "The three sustainability percentages must add up to exactly 100%.");
        document.getElementById("feasibilityError").scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }

      if (countWords(proposalDescInput.value) === 0) {
  showMessage("error", "Please describe how your research project aligns with the sustainability pillars.");
  proposalDescInput.scrollIntoView({ behavior: "smooth", block: "center" });
  proposalDescInput.focus();
  return;
}


      if (countWords(proposalDescInput.value) > MAX_DESC_WORDS) {
  showMessage("error", `The description must be ${MAX_DESC_WORDS} words or fewer.`);
  proposalDescInput.scrollIntoView({ behavior: "smooth", block: "center" });
  return;
}

      const submitButton = form.querySelector("button[type='submit']");
  const submitLabel = submitButton ? submitButton.textContent : "";
      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = "Submitting...";
      }

      const [env, social, eco] = getPillarValues();

const payload = {
  pi_id: Number(piIdInput.value),
  department: departmentSelect.value,
  pi_name: piSelect.value || "",
  project_title: projectTitleInput.value,
  environmental_pct: env,
  social_pct: social,
  economic_pct: eco,
  feasibility: document.getElementById("feasibility").value,
  proposal_desc: proposalDescInput.value.trim() ,
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
    cancelLookup();
        updateDescCount();
        secretKeyInput.value = "";
        secretKeyStatus.textContent = "";
        resetDirectoryFields("Enter your Unique Code first");
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
      submitButton.textContent = submitLabel; // restores whatever the HTML button said
        }
      }
    });