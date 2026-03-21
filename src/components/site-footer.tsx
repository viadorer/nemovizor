import { t } from "@/i18n";
import { brand } from "@/brands";

export function SiteFooter() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <img src="/branding/logo_nemovizor_web.png" alt={brand.name} />
          </div>
          <div className="footer-links">
            <ul>
              <li>
                <a href="#">{t.footer.about}</a>
              </li>
              <li>
                <a href="#">{t.footer.contact}</a>
              </li>
              <li>
                <a href="#">{t.footer.career}</a>
              </li>
              <li>
                <a href="#">{t.footer.terms}</a>
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
          <p>&copy; {new Date().getFullYear()} {t.footer.copyright}. {t.footer.allRightsReserved}</p>
        </div>
      </div>
    </footer>
  );
}
