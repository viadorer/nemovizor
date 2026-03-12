export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <img src="/branding/logo_nemovizor_web.png" alt="Nemovizor" />
          </div>
          <div className="footer-links">
            <ul>
              <li>
                <a href="#">O nás</a>
              </li>
              <li>
                <a href="#">Kontakt</a>
              </li>
              <li>
                <a href="#">Kariéra</a>
              </li>
              <li>
                <a href="#">Podmínky</a>
              </li>
            </ul>
          </div>
          <div className="footer-social">
            <a href="#" className="social-link">
              Facebook
            </a>
            <a href="#" className="social-link">
              Instagram
            </a>
            <a href="#" className="social-link">
              LinkedIn
            </a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>© 2026 Nemovizor. Všechna práva vyhrazena.</p>
        </div>
      </div>
    </footer>
  );
}
