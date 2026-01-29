import { GrapesEditor } from '../types/grapes';

export const initBlocks = (editor: GrapesEditor) => {
  const bm = editor.BlockManager;

  // ===== BASIC BLOCKS =====
  bm.add('section', {
    label: 'Section',
    category: 'Basic',
    attributes: { class: 'gjs-fonts gjs-f-b1' },
    content: `<section class="py-8 md:py-12 lg:py-16 px-4 md:px-6 lg:px-8">
      <h2 class="text-center mb-4 md:mb-6 text-2xl md:text-3xl lg:text-4xl font-bold text-gray-800">Section Title</h2>
      <p class="text-center max-w-2xl mx-auto text-sm md:text-base lg:text-lg text-gray-600">Add your content here. This is a basic section block.</p>
    </section>`,
  });

  bm.add('text', {
    label: 'Text',
    category: 'Basic',
    content: '<div data-gjs-type="text" class="text-sm md:text-base lg:text-lg text-gray-700">Insert your text here</div>',
  });

  bm.add('image', {
    label: 'Image',
    category: 'Basic',
    select: true,
    content: { type: 'image', classes: ['w-full', 'h-auto', 'rounded-lg'] },
    activate: true,
  });

  bm.add('video', {
    label: 'Video',
    category: 'Basic',
    content: {
      type: 'video',
      src: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      style: { height: '200px', width: '100%' },
      classes: ['w-full', 'h-48', 'md:h-64', 'lg:h-80', 'rounded-lg', 'shadow-md']
    },
  });

  bm.add('map', {
    label: 'Map',
    category: 'Basic',
    content: {
      type: 'map',
      style: { height: '200px', width: '100%' },
      classes: ['w-full', 'h-48', 'md:h-64', 'lg:h-80', 'rounded-lg', 'shadow-md']
    },
  });

  bm.add('link', {
    label: 'Link',
    category: 'Basic',
    content: '<a href="#" class="text-sm md:text-base text-indigo-500 hover:text-indigo-600 transition-colors no-underline">Click here</a>',
  });

  bm.add('link-block', {
    label: 'Link Block',
    category: 'Basic',
    content: '<a href="#" class="block p-3 md:p-4 lg:p-5 bg-slate-50 rounded-lg no-underline text-inherit hover:bg-slate-100 transition-colors border border-dashed border-slate-300 text-sm md:text-base">Link Block Content</a>',
  });

  // ===== LAYOUT BLOCKS =====
  bm.add('column1', {
    label: '1 Column',
    category: 'Layout',
    content: `<div class="flex flex-col p-2 md:p-3 lg:p-4">
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
    </div>`,
  });

  bm.add('column2', {
    label: '2 Columns',
    category: 'Layout',
    content: `<div class="flex flex-col md:flex-row p-2 md:p-3 gap-2 md:gap-3">
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
    </div>`,
  });

  bm.add('column3', {
    label: '3 Columns',
    category: 'Layout',
    content: `<div class="flex flex-col md:flex-row p-2 md:p-3 gap-2 md:gap-3">
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
      <div class="flex-1 p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
    </div>`,
  });

  bm.add('column37', {
    label: '2 Columns 3/7',
    category: 'Layout',
    content: `<div class="flex flex-col md:flex-row p-2 md:p-3 gap-2 md:gap-3">
      <div class="w-full md:w-[30%] p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
      <div class="w-full md:w-[70%] p-3 md:p-4 min-h-[60px] md:min-h-[75px] bg-slate-50 border border-dashed border-slate-300 rounded"></div>
    </div>`,
  });

  // ===== COMPONENT BLOCKS =====
  bm.add('button', {
    label: 'Button',
    category: 'Components',
    content: '<button class="py-2 md:py-3 px-4 md:px-6 bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-0 rounded-lg text-xs md:text-sm font-medium cursor-pointer hover:shadow-lg hover:to-indigo-600 transition-all transform hover:-translate-y-0.5">Click Me</button>',
  });

  bm.add('divider', {
    label: 'Divider',
    category: 'Components',
    content: '<hr class="border-0 border-t border-slate-200 my-3 md:my-4 lg:my-5" />',
  });

  bm.add('quote', {
    label: 'Quote',
    category: 'Components',
    content: `<blockquote class="border-l-4 border-indigo-500 pl-3 md:pl-4 lg:pl-5 pr-3 md:pr-4 lg:pr-5 py-3 md:py-4 lg:py-5 my-3 md:my-4 lg:my-5 bg-slate-50 italic rounded-r-lg text-sm md:text-base lg:text-lg">
      "This is a sample quote. Add your inspiring text here."
      <footer class="mt-2 md:mt-3 text-xs md:text-sm text-slate-500 not-italic">— Author Name</footer>
    </blockquote>`,
  });

  // ===== E-COMMERCE BLOCKS =====
  bm.add('product-card', {
    label: 'Product Card',
    category: 'E-commerce',
    content: `<div class="max-w-sm rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div class="w-full h-40 bg-slate-100 flex items-center justify-center text-slate-400 text-sm">Product Image</div>
      <div class="p-4">
        <h3 class="text-base font-semibold text-slate-800">Product Name</h3>
        <p class="text-xs text-slate-500 mt-1">Short description of the product.</p>
        <div class="flex items-center justify-between mt-4">
          <span class="text-indigo-600 font-semibold">$99.00</span>
          <button class="px-3 py-1 text-xs bg-indigo-500 text-white rounded hover:bg-indigo-600">Add to Cart</button>
        </div>
      </div>
    </div>`,
  });

  bm.add('hero', {
    label: 'Hero Section',
    category: 'Components',
    content: `<section class="py-12 md:py-20 lg:py-24 px-4 md:px-6 lg:px-8 text-center bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
      <h1 class="text-3xl md:text-4xl lg:text-5xl mb-3 md:mb-4 lg:mb-5 font-bold tracking-tight">Welcome to Your Website</h1>
      <p class="text-base md:text-lg lg:text-xl max-w-sm md:max-w-lg lg:max-w-xl mx-auto mb-5 md:mb-6 lg:mb-8 opacity-90 leading-relaxed">Create something amazing with our powerful web builder. No coding required.</p>
      <button class="py-3 md:py-4 px-5 md:px-6 lg:px-8 bg-white text-indigo-600 border-0 rounded-lg text-sm md:text-base font-bold cursor-pointer hover:bg-opacity-90 transition-opacity shadow-xl">Get Started</button>
    </section>`,
  });

  bm.add('card', {
    label: 'Card',
    category: 'Components',
    content: `<div class="w-full max-w-[280px] md:max-w-[320px] lg:max-w-[350px] bg-white rounded-xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow duration-300 mx-auto">
      <div class="h-32 md:h-40 lg:h-48 bg-gradient-to-br from-indigo-500 to-violet-600"></div>
      <div class="p-3 md:p-4 lg:p-5">
        <h3 class="m-0 mb-2 text-slate-800 text-base md:text-lg lg:text-xl font-bold">Card Title</h3>
        <p class="m-0 mb-3 md:mb-4 text-slate-500 text-xs md:text-sm leading-relaxed">This is a sample card description. Add your content here.</p>
        <button class="py-2 md:py-2.5 px-4 md:px-5 bg-indigo-500 text-white border-0 rounded-md text-xs md:text-sm cursor-pointer hover:bg-indigo-600 transition-colors">Learn More</button>
      </div>
    </div>`,
  });

  bm.add('testimonial', {
    label: 'Testimonial',
    category: 'Components',
    content: `<div class="w-full max-w-sm md:max-w-md lg:max-w-lg p-4 md:p-6 lg:p-8 bg-white rounded-xl shadow-lg text-center mx-auto border border-slate-100">
      <div class="w-14 h-14 md:w-16 md:h-16 lg:w-20 lg:h-20 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full mx-auto mb-3 md:mb-4 lg:mb-5 shadow-inner"></div>
      <p class="text-sm md:text-base lg:text-lg text-slate-700 italic leading-relaxed mb-3 md:mb-4 lg:mb-5">"This is an amazing product. It has completely transformed how we work!"</p>
      <div class="font-bold text-slate-800 text-sm md:text-base">Jane Doe</div>
      <p class="text-xs md:text-sm text-slate-500 mt-1">CEO, Company Inc.</p>
    </div>`,
  });

  bm.add('pricing', {
    label: 'Pricing Card',
    category: 'Components',
    content: `<div class="w-full max-w-[260px] md:max-w-[280px] lg:max-w-[300px] p-4 md:p-6 lg:p-8 bg-white rounded-xl shadow-lg text-center border border-slate-100 hover:border-indigo-500 transition-colors cursor-pointer group mx-auto">
      <h3 class="m-0 mb-2 text-slate-800 text-base md:text-lg lg:text-xl font-bold group-hover:text-indigo-600 transition-colors">Pro Plan</h3>
      <div class="text-3xl md:text-4xl lg:text-5xl font-bold text-indigo-500 my-3 md:my-4 lg:my-5">$29<span class="text-sm md:text-base lg:text-lg font-normal text-slate-500">/mo</span></div>
      <ul class="list-none p-0 my-3 md:my-4 lg:my-5 text-left space-y-2 md:space-y-3">
        <li class="pb-2 border-b border-slate-100 text-slate-700 flex items-center gap-2 text-xs md:text-sm">
          <span class="text-green-500">✓</span> Unlimited Projects
        </li>
        <li class="pb-2 border-b border-slate-100 text-slate-700 flex items-center gap-2 text-xs md:text-sm">
          <span class="text-green-500">✓</span> Priority Support
        </li>
        <li class="pb-2 text-slate-700 flex items-center gap-2 text-xs md:text-sm">
          <span class="text-green-500">✓</span> Custom Domain
        </li>
      </ul>
      <button class="w-full py-2.5 md:py-3 lg:py-3.5 bg-gradient-to-br from-indigo-500 to-violet-600 text-white border-0 rounded-lg text-sm md:text-base font-medium cursor-pointer shadow-lg hover:shadow-indigo-500/40 transition-all">Get Started</button>
    </div>`,
  });

  bm.add('navbar', {
    label: 'Navbar',
    category: 'Components',
    content: `<nav class="flex flex-wrap justify-between items-center py-3 md:py-4 px-4 md:px-6 lg:px-8 bg-white shadow-md sticky top-0 z-50">
      <div class="text-xl md:text-2xl font-bold text-indigo-600">Logo</div>
      <div class="hidden md:flex gap-4 lg:gap-8">
        <a href="#" class="text-sm lg:text-base text-slate-600 hover:text-indigo-600 no-underline font-medium transition-colors">Home</a>
        <a href="#" class="text-sm lg:text-base text-slate-600 hover:text-indigo-600 no-underline font-medium transition-colors">About</a>
        <a href="#" class="text-sm lg:text-base text-slate-600 hover:text-indigo-600 no-underline font-medium transition-colors">Services</a>
        <a href="#" class="text-sm lg:text-base text-slate-600 hover:text-indigo-600 no-underline font-medium transition-colors">Contact</a>
      </div>
      <button class="py-2 md:py-2.5 px-4 md:px-5 bg-indigo-600 text-white border-0 rounded-md text-xs md:text-sm font-medium cursor-pointer hover:bg-indigo-700 transition-colors">Sign Up</button>
    </nav>`,
  });

  bm.add('footer', {
    label: 'Footer',
    category: 'Components',
    content: `<footer class="pt-10 md:pt-12 lg:pt-16 pb-6 md:pb-8 px-4 md:px-6 lg:px-8 bg-slate-900 text-white">
      <div class="flex flex-col md:flex-row flex-wrap justify-between max-w-6xl mx-auto mb-6 md:mb-8 lg:mb-10 gap-6 md:gap-8">
        <div class="w-full md:w-auto md:min-w-[200px] mb-4 md:mb-0">
          <h4 class="text-lg md:text-xl m-0 mb-3 md:mb-4 lg:mb-5 text-indigo-500 font-bold">Company</h4>
          <p class="text-sm md:text-base text-slate-400 leading-6 md:leading-7">Building the future of web design, one pixel at a time.</p>
        </div>
        <div class="w-1/2 md:w-auto md:min-w-[150px]">
          <h4 class="text-sm md:text-base m-0 mb-3 md:mb-4 lg:mb-5 font-bold text-slate-200">Quick Links</h4>
          <div class="space-y-2 md:space-y-3">
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">Home</a>
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">About</a>
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">Contact</a>
          </div>
        </div>
        <div class="w-1/2 md:w-auto md:min-w-[150px]">
          <h4 class="text-sm md:text-base m-0 mb-3 md:mb-4 lg:mb-5 font-bold text-slate-200">Legal</h4>
          <div class="space-y-2 md:space-y-3">
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">Privacy</a>
            <a href="#" class="block text-sm text-slate-400 hover:text-white no-underline transition-colors">Terms</a>
          </div>
        </div>
      </div>
      <div class="text-center pt-4 md:pt-6 lg:pt-8 border-t border-slate-800 text-slate-500 text-xs md:text-sm">
        © 2024 Company. All rights reserved.
      </div>
    </footer>`,
  });

  // ===== FORM BLOCKS =====
  bm.add('form', {
    label: 'Form',
    category: 'Forms',
    content: `<form class="w-full max-w-[320px] md:max-w-[360px] lg:max-w-[400px] p-4 md:p-6 lg:p-8 bg-white rounded-xl shadow-lg border border-slate-100 mx-auto">
      <h3 class="m-0 mb-3 md:mb-4 lg:mb-5 text-slate-800 text-lg md:text-xl font-bold">Contact Us</h3>
      <div class="mb-3 md:mb-4">
        <label class="block mb-1 md:mb-1.5 text-xs md:text-sm text-slate-600 font-medium">Name</label>
        <input type="text" placeholder="Your name" class="w-full p-2.5 md:p-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
      </div>
      <div class="mb-3 md:mb-4">
        <label class="block mb-1 md:mb-1.5 text-xs md:text-sm text-slate-600 font-medium">Email</label>
        <input type="email" placeholder="your@email.com" class="w-full p-2.5 md:p-3 border border-slate-200 rounded-md text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all" />
      </div>
      <div class="mb-4 md:mb-5">
        <label class="block mb-1 md:mb-1.5 text-xs md:text-sm text-slate-600 font-medium">Message</label>
        <textarea placeholder="Your message" rows="4" class="w-full p-2.5 md:p-3 border border-slate-200 rounded-md text-sm resize-y focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"></textarea>
      </div>
      <button type="submit" class="w-full py-2.5 md:py-3 bg-indigo-600 text-white border-0 rounded-md text-xs md:text-sm font-medium cursor-pointer hover:bg-indigo-700 transition-colors shadow-md">Send Message</button>
    </form>`,
  });

  bm.add('input', {
    label: 'Input',
    category: 'Forms',
    content: '<input type="text" placeholder="Enter text" class="p-2.5 md:p-3 border border-slate-200 rounded-md text-sm w-full focus:outline-none focus:border-indigo-500 transition-colors" />',
  });

  bm.add('textarea', {
    label: 'Textarea',
    category: 'Forms',
    content: '<textarea placeholder="Enter text" rows="4" class="w-full p-2.5 md:p-3 border border-slate-200 rounded-md text-sm resize-y focus:outline-none focus:border-indigo-500 transition-colors"></textarea>',
  });

  bm.add('select', {
    label: 'Select',
    category: 'Forms',
    content: `<select class="p-2.5 md:p-3 border border-slate-200 rounded-md text-sm w-full focus:outline-none focus:border-indigo-500 transition-colors bg-white">
      <option value="">Select an option</option>
      <option value="1">Option 1</option>
      <option value="2">Option 2</option>
      <option value="3">Option 3</option>
    </select>`,
  });

  bm.add('checkbox', {
    label: 'Checkbox',
    category: 'Forms',
    content: `<label class="flex items-center gap-2 cursor-pointer select-none">
      <input type="checkbox" class="w-4 h-4 md:w-4.5 md:h-4.5 text-indigo-600 rounded focus:ring-indigo-500 border-gray-300" />
      <span class="text-xs md:text-sm text-slate-600">Checkbox label</span>
    </label>`,
  });

  bm.add('radio', {
    label: 'Radio',
    category: 'Forms',
    content: `<div>
      <label class="flex items-center gap-2 cursor-pointer select-none mb-2">
        <input type="radio" name="radio-group" class="w-4 h-4 md:w-4.5 md:h-4.5 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
        <span class="text-xs md:text-sm text-slate-600">Option 1</span>
      </label>
      <label class="flex items-center gap-2 cursor-pointer select-none">
        <input type="radio" name="radio-group" class="w-4 h-4 md:w-4.5 md:h-4.5 text-indigo-600 focus:ring-indigo-500 border-gray-300" />
        <span class="text-xs md:text-sm text-slate-600">Option 2</span>
      </label>
    </div>`,
  });
};
