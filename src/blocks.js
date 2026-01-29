/**
 * GrapesJS Custom Blocks
 * @description All custom block definitions for the editor
 * @version 1.0.0
 */

/**
 * Initialize all custom blocks
 * @param {Object} editor - GrapesJS editor instance
 */
export function initBlocks(editor) {
  const bm = editor.BlockManager;

  // ===== BASIC BLOCKS =====
  bm.add('section', {
    label: 'Section',
    category: 'Basic',
    attributes: { class: 'gjs-fonts gjs-f-b1' },
    content: `<section style="padding: 50px 20px;">
      <h2 style="text-align: center; margin-bottom: 20px;">Section Title</h2>
      <p style="text-align: center; max-width: 600px; margin: 0 auto;">Add your content here. This is a basic section block.</p>
    </section>`,
  });

  bm.add('text', {
    label: 'Text',
    category: 'Basic',
    content: '<div data-gjs-type="text">Insert your text here</div>',
  });

  bm.add('image', {
    label: 'Image',
    category: 'Basic',
    select: true,
    content: { type: 'image' },
    activate: true,
  });

  bm.add('video', {
    label: 'Video',
    category: 'Basic',
    content: {
      type: 'video',
      src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      style: { width: '100%', height: '315px' }
    },
  });

  bm.add('map', {
    label: 'Map',
    category: 'Basic',
    content: {
      type: 'map',
      style: { width: '100%', height: '350px' }
    },
  });

  bm.add('link', {
    label: 'Link',
    category: 'Basic',
    content: '<a href="#" style="color: #6366f1; text-decoration: none;">Click here</a>',
  });

  bm.add('link-block', {
    label: 'Link Block',
    category: 'Basic',
    content: '<a href="#" style="display: block; padding: 20px; background: #f8fafc; border-radius: 8px; text-decoration: none; color: inherit;">Link Block Content</a>',
  });

  // ===== LAYOUT BLOCKS =====
  bm.add('column1', {
    label: '1 Column',
    category: 'Layout',
    content: `<div class="row" style="display: flex; padding: 10px;">
      <div class="column" style="flex: 1; padding: 10px; min-height: 75px; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
    </div>`,
  });

  bm.add('column2', {
    label: '2 Columns',
    category: 'Layout',
    content: `<div class="row" style="display: flex; padding: 10px;">
      <div class="column" style="flex: 1; padding: 10px; min-height: 75px; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
      <div class="column" style="flex: 1; padding: 10px; min-height: 75px; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
    </div>`,
  });

  bm.add('column3', {
    label: '3 Columns',
    category: 'Layout',
    content: `<div class="row" style="display: flex; padding: 10px;">
      <div class="column" style="flex: 1; padding: 10px; min-height: 75px; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
      <div class="column" style="flex: 1; padding: 10px; min-height: 75px; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
      <div class="column" style="flex: 1; padding: 10px; min-height: 75px; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
    </div>`,
  });

  bm.add('column37', {
    label: '2 Columns 3/7',
    category: 'Layout',
    content: `<div class="row" style="display: flex; padding: 10px;">
      <div class="column" style="flex-basis: 30%; padding: 10px; min-height: 75px; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
      <div class="column" style="flex-basis: 70%; padding: 10px; min-height: 75px; background: #f8fafc; border: 1px dashed #cbd5e1;"></div>
    </div>`,
  });

  // ===== COMPONENT BLOCKS =====
  bm.add('button', {
    label: 'Button',
    category: 'Components',
    content: '<button style="padding: 12px 24px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer;">Click Me</button>',
  });

  bm.add('divider', {
    label: 'Divider',
    category: 'Components',
    content: '<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />',
  });

  bm.add('quote', {
    label: 'Quote',
    category: 'Components',
    content: `<blockquote style="border-left: 4px solid #6366f1; padding: 20px; margin: 20px 0; background: #f8fafc; font-style: italic;">
      "This is a sample quote. Add your inspiring text here."
      <footer style="margin-top: 10px; font-size: 14px; color: #64748b;">— Author Name</footer>
    </blockquote>`,
  });

  bm.add('hero', {
    label: 'Hero Section',
    category: 'Components',
    content: `<section style="padding: 100px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
      <h1 style="font-size: 48px; margin-bottom: 20px; font-weight: 700;">Welcome to Your Website</h1>
      <p style="font-size: 20px; max-width: 600px; margin: 0 auto 30px; opacity: 0.9;">Create something amazing with our powerful web builder. No coding required.</p>
      <button style="padding: 16px 32px; background: white; color: #667eea; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer;">Get Started</button>
    </section>`,
  });

  bm.add('card', {
    label: 'Card',
    category: 'Components',
    content: `<div style="max-width: 350px; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
      <div style="height: 200px; background: linear-gradient(135deg, #6366f1, #8b5cf6);"></div>
      <div style="padding: 20px;">
        <h3 style="margin: 0 0 10px; color: #1e293b;">Card Title</h3>
        <p style="margin: 0 0 15px; color: #64748b; font-size: 14px;">This is a sample card description. Add your content here.</p>
        <button style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 14px; cursor: pointer;">Learn More</button>
      </div>
    </div>`,
  });

  bm.add('testimonial', {
    label: 'Testimonial',
    category: 'Components',
    content: `<div style="max-width: 500px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center;">
      <div style="width: 80px; height: 80px; background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 50%; margin: 0 auto 20px;"></div>
      <p style="font-size: 18px; color: #334155; line-height: 1.6; font-style: italic; margin-bottom: 20px;">"This is an amazing product. It has completely transformed how we work!"</p>
      <p style="font-weight: 600; color: #1e293b; margin: 0;">Jane Doe</p>
      <p style="font-size: 14px; color: #64748b; margin: 5px 0 0;">CEO, Company Inc.</p>
    </div>`,
  });

  bm.add('pricing', {
    label: 'Pricing Card',
    category: 'Components',
    content: `<div style="max-width: 300px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); text-align: center;">
      <h3 style="margin: 0 0 10px; color: #1e293b;">Pro Plan</h3>
      <div style="font-size: 48px; font-weight: 700; color: #6366f1; margin: 20px 0;">$29<span style="font-size: 18px; font-weight: 400; color: #64748b;">/mo</span></div>
      <ul style="list-style: none; padding: 0; margin: 20px 0; text-align: left;">
        <li style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #334155;">✓ Unlimited Projects</li>
        <li style="padding: 10px 0; border-bottom: 1px solid #e2e8f0; color: #334155;">✓ Priority Support</li>
        <li style="padding: 10px 0; color: #334155;">✓ Custom Domain</li>
      </ul>
      <button style="width: 100%; padding: 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; cursor: pointer;">Get Started</button>
    </div>`,
  });

  bm.add('navbar', {
    label: 'Navbar',
    category: 'Components',
    content: `<nav style="display: flex; justify-content: space-between; align-items: center; padding: 15px 30px; background: white; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
      <div style="font-size: 24px; font-weight: 700; color: #6366f1;">Logo</div>
      <div style="display: flex; gap: 30px;">
        <a href="#" style="color: #334155; text-decoration: none; font-weight: 500;">Home</a>
        <a href="#" style="color: #334155; text-decoration: none; font-weight: 500;">About</a>
        <a href="#" style="color: #334155; text-decoration: none; font-weight: 500;">Services</a>
        <a href="#" style="color: #334155; text-decoration: none; font-weight: 500;">Contact</a>
      </div>
      <button style="padding: 10px 20px; background: #6366f1; color: white; border: none; border-radius: 6px; font-weight: 500; cursor: pointer;">Sign Up</button>
    </nav>`,
  });

  bm.add('footer', {
    label: 'Footer',
    category: 'Components',
    content: `<footer style="padding: 60px 30px 30px; background: #1e293b; color: white;">
      <div style="display: flex; flex-wrap: wrap; justify-content: space-between; max-width: 1200px; margin: 0 auto 40px;">
        <div style="min-width: 200px; margin-bottom: 30px;">
          <h4 style="font-size: 20px; margin: 0 0 20px; color: #6366f1;">Company</h4>
          <p style="color: #94a3b8; line-height: 1.8;">Building the future of web design, one pixel at a time.</p>
        </div>
        <div style="min-width: 150px; margin-bottom: 30px;">
          <h4 style="font-size: 16px; margin: 0 0 20px;">Quick Links</h4>
          <a href="#" style="display: block; color: #94a3b8; text-decoration: none; margin-bottom: 10px;">Home</a>
          <a href="#" style="display: block; color: #94a3b8; text-decoration: none; margin-bottom: 10px;">About</a>
          <a href="#" style="display: block; color: #94a3b8; text-decoration: none;">Contact</a>
        </div>
        <div style="min-width: 150px; margin-bottom: 30px;">
          <h4 style="font-size: 16px; margin: 0 0 20px;">Legal</h4>
          <a href="#" style="display: block; color: #94a3b8; text-decoration: none; margin-bottom: 10px;">Privacy</a>
          <a href="#" style="display: block; color: #94a3b8; text-decoration: none;">Terms</a>
        </div>
      </div>
      <div style="text-align: center; padding-top: 30px; border-top: 1px solid #334155; color: #64748b;">
        © 2024 Company. All rights reserved.
      </div>
    </footer>`,
  });

  // ===== FORM BLOCKS =====
  bm.add('form', {
    label: 'Form',
    category: 'Forms',
    content: `<form style="max-width: 400px; padding: 30px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
      <h3 style="margin: 0 0 20px; color: #1e293b;">Contact Us</h3>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #334155;">Name</label>
        <input type="text" placeholder="Your name" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;" />
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #334155;">Email</label>
        <input type="email" placeholder="your@email.com" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px;" />
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 5px; font-size: 14px; color: #334155;">Message</label>
        <textarea placeholder="Your message" rows="4" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; resize: vertical;"></textarea>
      </div>
      <button type="submit" style="width: 100%; padding: 12px; background: #6366f1; color: white; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer;">Send Message</button>
    </form>`,
  });

  bm.add('input', {
    label: 'Input',
    category: 'Forms',
    content: '<input type="text" placeholder="Enter text" style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; width: 100%;" />',
  });

  bm.add('textarea', {
    label: 'Textarea',
    category: 'Forms',
    content: '<textarea placeholder="Enter text" rows="4" style="width: 100%; padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; resize: vertical;"></textarea>',
  });

  bm.add('select', {
    label: 'Select',
    category: 'Forms',
    content: `<select style="padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 14px; width: 100%;">
      <option value="">Select an option</option>
      <option value="1">Option 1</option>
      <option value="2">Option 2</option>
      <option value="3">Option 3</option>
    </select>`,
  });

  bm.add('checkbox', {
    label: 'Checkbox',
    category: 'Forms',
    content: `<label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
      <input type="checkbox" style="width: 18px; height: 18px;" />
      <span style="font-size: 14px; color: #334155;">Checkbox label</span>
    </label>`,
  });

  bm.add('radio', {
    label: 'Radio',
    category: 'Forms',
    content: `<div>
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; margin-bottom: 8px;">
        <input type="radio" name="radio-group" style="width: 18px; height: 18px;" />
        <span style="font-size: 14px; color: #334155;">Option 1</span>
      </label>
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
        <input type="radio" name="radio-group" style="width: 18px; height: 18px;" />
        <span style="font-size: 14px; color: #334155;">Option 2</span>
      </label>
    </div>`,
  });
}
