export class AboutDialog {
  readonly dialog: HTMLDialogElement;

  constructor() {
    this.dialog = document.createElement("dialog");
    this.dialog.className = "about-dialog";
    this.dialog.innerHTML = `
      <form method="dialog" class="dialog-frame">
        <button class="dialog-close" aria-label="关闭">×</button>
        <span class="section-kicker">关于 · ABOUT</span>
        <h2>步天 BuTian</h2>
        <p>以真实天体位置连接三维星空、黄道投影与中国传统天文盘面。</p>
        <ul>
          <li>恒星数据：ESA Gaia DR3，经 Gaia Sky 整理；含 Hipparcos。</li>
          <li>中国星空文化：Stellarium Chinese skyculture，GPL-2.0+。</li>
          <li>银河背景：Stellarium Milky Way HiPS，基于 Stellarium 银河纹理，
            2019-02-12 版本。</li>
          <li>深空天体：Stellarium Mobile base DSO survey，2020-02-05 版本。</li>
          <li>西方星座与插图：Stellarium Western skyculture；Stellarium's team，
            由 Susanne M Hoffmann 与 Stellarium's team 重制；GNU GPL v2.0。</li>
          <li>太阳系历算：astronomy-engine 2.1.19，MIT License。</li>
          <li>行星纹理：Gaia Sky（ESA / Gaia Sky data team）及其原始来源。</li>
          <li>金星表面：Praesepe，CC-BY-NC；云图改编自 NASA/JPL/Seal，
            CC-BY-NC。</li>
        </ul>
        <p class="about-note">本应用只呈现天文与历法结构，不作命理推断。</p>
      </form>
    `;
    document.body.append(this.dialog);
  }

  open(): void {
    this.dialog.showModal();
  }
}
