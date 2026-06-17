module.exports = async function track(req, res) {
  if (req.method !== "POST") {
    res.setHeader("allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  return res.status(200).json({ ok: true });
};
