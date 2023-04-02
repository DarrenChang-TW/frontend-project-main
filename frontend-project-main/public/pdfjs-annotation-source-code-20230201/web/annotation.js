var canvasWrapper = '';
var text_canvas = '';
var show_annotation_list = false;
var stop_process_annotation = false; // For termination under special circumstances 用于特殊情况的终止
var touchState = null; //An object that records the touch point information of a touch screen gesture 记录触屏手势触点信息的对象
var add_water_mark = false;
var ctx = '';
var pdf_viewer = '';
var annotation_id = '';
var member_id = 'member_id';
var text_layer_width = 0.0;
var text_layer_height = 0.0;
var x = '',
	y = '',
	m_x = '',
	m_y = '',
	_x = '',
	_y = '',
	true_width = 0.0,
	true_height = 0.0,
	start_annotation = false, //activate highlight or not 调试时默认打开标注
	text_layer = '',
	last_click_node_id = '',
	annotations_json = [],
	annotation_type = 'highlight'; //set highlight as default annotation type for text 默认批注为高亮

var canvas_text_scale_x = 0.0;
var canvas_text_scale_y = 0.0;

var annotation_data = {};
var fabric_list = {}; //Fabric layer list for all pdf pages
var fabric_top = false; //place Fabric layer at the top level when editing annotatioin objects 编辑对象时将fabric放置在顶层
var free_draw = false;
var custom_attr = ['id', 'hasControls', 'hasRotatingPoint', 'hasBorders', 'selectable', 'lockMovementX',
	'lockMovementY', 'opacity', 'crossOrigin'
];
var fabric_annos_id_tag = 'annos-for-page-';
var active_fabric_obj = {
	'page_number': null,
	'active_element': null,
}; //activated fabric annotation object 激活的fabric 元素

//listen mouseup event for text highlight and underline 监听高亮和下划线批注激活时鼠标抬起的主函数
function getMouseUpPos(e) {
	// console.log('鼠标抬起');
	//tips are tips for user operation, you can add you langauge tips and set tips_language
	//tips 是用户操作后对应的提示，可以自由添加更多的语言
	var tips = {
		'zh-cn': [
			'不能跨页批注对象，请重新选择',
			'选择对象过多无法批注！',
			'无法批注倾斜文字',
			'选择了过多对象无法完成标注，请重新选择',
		],
		'en': [
			'cross page annotating is not supported!',
			'too many annotating content!',
			'rotate content annotating is not supported!',
			'too many annotating content!',
		]
	} [tips_language];

	var sel = window.getSelection();
	if (sel.isCollapsed == true) {
		closeCopyConfirm();
		return;
	};
	if (start_annotation == false) {
		if (post_to_parent == true) {
			var select_text = sel.toString();
			window.parent.postMessage({
				"type": 6,
				"source": "pdfjs",
				"content": select_text
			}, '*');
		}
		return;
	}
	stop_process_annotation = false; //For termination under special circumstances 用于特殊情况的终止

	var Range = sel.getRangeAt(0);
	var judge_result = judgeOnePage(Range);
	if (judge_result.one_page == false) {
		alert(tips[0]);
		window.getSelection().removeAllRanges();
		return;
	}
	//read annotation for current page 读当前页面注释
	readAnnotationsJson();
	var spans = getSelSpans(Range);
	if (spans.length > 500) {
		alert(tips[1]);
		window.getSelection().removeAllRanges();
		return;
	}

	var this_page = judge_result.this_page;
	canvasWrapper = this_page.getElementsByClassName('canvasWrapper')[0];
	text_canvas = canvasWrapper.getElementsByTagName('canvas')[0];
	// console.log('text_layer',text_layer);
	ctx = text_canvas.getContext("2d");

	//initial empty annotation object 初始化空标注对象
	initAnnotation();
	true_width = getNumberFromStyle(text_canvas.style.width, 'px');
	true_height = getNumberFromStyle(text_canvas.style.height, 'px');

	text_layer_width = getNumberFromStyle(text_layer.style.width, 'px');
	text_layer_height = getNumberFromStyle(text_layer.style.height, 'px');

	var canvas_scale_x = (text_canvas.width / true_width).toFixed(8);
	var canvas_scale_y = (text_canvas.height / true_height).toFixed(8);

	canvas_text_scale_x = (true_width / text_layer_width).toFixed(8);
	canvas_text_scale_y = (true_height / text_layer_height).toFixed(8);

	var all_str = getAllStrAndHighlightSpan(spans, Range, canvas_scale_x, canvas_scale_y, sel);
	if (stop_process_annotation == true) {
		alert(tips[2]);
		window.getSelection().removeAllRanges();
		return;
	}

	annotation_data.rects = joinRects(annotation_data.rects);
	if (annotation_data.rects.length > 100) {
		alert(tips[3]);
		window.getSelection().removeAllRanges();
		return;
	}

	//save annotation data to json 保存数据到json
	annotataion_data = addAnnotationData(annotation_data, all_str, text_canvas, canvas_scale_x, canvas_scale_y,
		annotation_type, this_page);
	annotation_data.id = buildId(annotations_json.length + 1);
	// post highlight data 广播暴露高亮信息
	postAnnotationData(annotation_data);
	annotations_json.push(annotation_data);
	saveAnnotationsJson(annotation_id, annotations_json);
	// refreshCanvas();
	addAnnotationToFabric(annotation_data, this_page);
	saveAllFabricData(); // save all Fabric annotation data to localStorage 保存批注数据到缓存
	if (show_annotation_list) {
		showAnnotationList();
	}
}

//highlight or underline text after selection 选中文本后高亮或下划线
function singleHighlightAndUnderline(op) {
	var old_start_annotation = start_annotation;
	var old_annotation_type = annotation_type;

	start_annotation = true;
	if (op == 0) {
		annotation_type = 'highlight';
	} else {
		annotation_type = 'underline';
	}
	getMouseUpPos();

	start_annotation = old_start_annotation;
	annotation_type = old_annotation_type;
	closeCopyConfirm();
}

//copy text after slection 选中后复制文字
function singleCopy() {
	var this_text = window.getSelection().toString();
	copyText(this_text);
	closeCopyConfirm();
}

//show operation buttons [highlignt/underline/copy/cancel] after selection 选中后显示按钮[高亮/下划线/复制/取消]
function showCopyConfirm(disX, disY) {
	let el = document.getElementById("ff-copyconfirm-btn");
	el.style.left = disX + 'px';
	el.style.top = disY + 'px';
	el.removeAttribute('hidden');
}

//hide operation buttons [highlignt/underline/copy/cancel] 隐藏操作按钮[高亮/下划线/复制/取消]
function closeCopyConfirm() {
	let el = document.getElementById("ff-copyconfirm-btn");
	el.style.left = '-50px';
	el.style.top = '-50px';
	el.setAttribute('hidden', true);
	window.getSelection().removeAllRanges();
	document.removeEventListener("selectionchange", endSelectionChangeListen, true);
}

//lsten text selection 监听文本选择
function selectionAct() {
	var selection = document.getSelection();
	if (selection.isCollapsed == true) {
		return;
	}
	var oRange = selection.getRangeAt(0);
	// const oRect = oRange.getBoundingClientRect();
	//get positioin for selection text rectangle and show operation buttons [highlignt/underline/copy/cancel] in the top of first rectangle
	//获取选择区域的矩形位置，在第一个矩形位置上方显示操作按钮[高亮/下划线/复制/取消]
	var rects = oRange.getClientRects();
	var last_rect = rects[0];
	showCopyConfirm(last_rect.left, last_rect.top - 35);
}

//juge whether the selected object spans pages 判断选择的对象有无跨页
function judgeOnePage(Range) {
	if (Range.commonAncestorContainer.nodeType != 3 && Range.commonAncestorContainer.getAttribute('id') == 'viewer') {
		// alert('跨页选择了');
		return {
			'one_page': false,
			'this_page': null,
		};
	}

	var this_page = null;
	if (Range.commonAncestorContainer.nodeType == 3) {
		this_page = Range.commonAncestorContainer.parentElement;
	} else {
		this_page = Range.commonAncestorContainer;
	}

	// console.log('this_page',this_page.parentElement);

	var data_page_number = this_page.getAttribute('data-page-number');
	while (data_page_number == null) {
		this_page = this_page.parentElement;
		data_page_number = this_page.getAttribute('data-page-number');
	}

	text_layer = this_page.getElementsByClassName('textLayer')[0];

	annotation_id = PDFViewerApplication.baseUrl + '_page_' + data_page_number;
	addIdForTextLayerSpan(
		this_page);
	return {
		'one_page': true,
		'this_page': this_page,
	};
}

//join adjacent annotation rectangles   合并相邻的批注矩形
function joinRects(old_rects) {
	// [scale_left, scale_top, scale_width, scale_height];
	var rect_dict_list = [];

	if (annotation_type == 'highlight') {
		for (var i = 0; i < old_rects.length; i++) {
			var this_rect = old_rects[i];
			rect_dict_list = addRectToRectDictHighlight(this_rect, rect_dict_list, i);
		}
	} else {
		for (var i = 0; i < old_rects.length; i++) {
			var this_rect = old_rects[i];
			rect_dict_list = addRectToRectDictUnderline(this_rect, rect_dict_list, i);
		}
	}

	//new rects after joining 合并后的新列表
	var new_rects = [];
	for (var j = 0; j < rect_dict_list.length; j++) {
		new_rects.push(rect_dict_list[j]['uni_rect']);
	}
	return new_rects;
}

//join two highlight rectangle 合并两个高亮矩形对象
function addRectToRectDictHighlight(this_rect, rect_dict_list, this_index) {
	if (rect_dict_list.length == 0) {
		rect_dict_list.push({
			'scale_top': this_rect[1],
			'scale_height': this_rect[3],
			'uni_rect': this_rect,
			'index': this_index,
		});
		return rect_dict_list;
	}
	//Compare the starting top and height, and merge the starting left and width if they are equal 比对起始top和高度，两者相等时合并起始的左边和宽度
	for (var i = 0; i < rect_dict_list.length; i++) {
		var rect_dict = rect_dict_list[i];

		//起始top和height都相等，合并两个区域,判断两个rect是否相邻
		// if (this_rect[1]==rect_dict['scale_top'] && this_rect[3]==rect_dict['scale_height'] && this_index==(rect_dict['index']+1)){
		// 	var new_rect=uniTwoRect(rect_dict['uni_rect'],this_rect);
		// 	rect_dict_list[i]['uni_rect']=new_rect;
		// 	rect_dict_list[i]['index']=this_index;
		// 	return rect_dict_list; 
		// }

		//do not judge whether two RECts are adjacent 不判断两个rect是否相邻
		if (this_rect[1] == rect_dict['scale_top'] && this_rect[3] == rect_dict['scale_height']) {
			var new_rect = uniTwoRect(rect_dict['uni_rect'], this_rect);
			rect_dict_list[i]['uni_rect'] = new_rect;
			rect_dict_list[i]['index'] = this_index;
			return rect_dict_list;
		}
	}

	//add new rect_list if they don't have equal left and height 宽高都不相等则新增
	rect_dict_list.push({
		'scale_top': this_rect[1],
		'scale_height': this_rect[3],
		'uni_rect': this_rect,
		'index': this_index,
	});

	return rect_dict_list;
}

//join two udnerline rectangle 合并两个下划线矩形对象
function addRectToRectDictUnderline(this_rect, rect_dict_list, this_index) {
	if (rect_dict_list.length == 0) {
		rect_dict_list.push({
			'x1': this_rect[0],
			'y1': this_rect[1],
			'uni_rect': this_rect,
			'index': this_index,
		});
		return rect_dict_list;
	}
	//Compare the starting top and height, and merge the starting left and width if they are equal 比对起始top和高度，两者相等时合并起始的左边和宽度
	for (var i = 0; i < rect_dict_list.length; i++) {
		var rect_dict = rect_dict_list[i];

		//judge whether two RECts are adjacent 判断两个rect是否相邻
		if (this_rect[1] == rect_dict['y1'] && this_index == (rect_dict['index'] + 1)) {
			rect_dict_list[i]['uni_rect'] = [rect_dict['x1'], rect_dict['y1'], this_rect[2], this_rect[3]];
			rect_dict_list[i]['index'] = this_index;
			return rect_dict_list;
		}
	}

	//add new rect_list if they don't have equal left and height 宽高都不相等则新增
	rect_dict_list.push({
		'x1': this_rect[0],
		'y1': this_rect[1],
		'uni_rect': this_rect,
		'index': this_index,
	});

	return rect_dict_list;
}

// join two rect position 合并两个矩形的坐标
function uniTwoRect(rect_one, rect_two) {
	var scale_left = Math.min.apply(null, [rect_one[0], rect_two[0]]);
	var scale_width = rect_two[0] + rect_two[2] - rect_one[0];
	var new_rect = [scale_left, rect_one[1], scale_width, rect_one[3]];
	return new_rect;
}

//get seletion spans 获取选中的<span>
function getSelSpans(Range) {
	var this_frames = Range.cloneContents();
	var new_div = document.createElement('div');
	new_div.appendChild(this_frames);
	var spans = new_div.getElementsByTagName('span');

	if (spans.length == 0) {
		return spans;
	} else {
		var new_spans = [];
		for (var i = 0; i < spans.length; i++) {
			if (spans[i].classList[0] != 'markedContent') {
				new_spans.push(spans[i]);
			}
		}
		return new_spans;
	}
}

//initial empty annotation object 初始化空批注对象
function initAnnotation() {
	annotation_data = {
		'id': null,
		'page_number': 0,
		'member_id': member_id,
		'save_scale_x': 0,
		'save_scale_y': 0,
		'conmment': '',
		'type': '',
		'true_size': [],
		'all_rect': 0,
		'all_str': '',
		'rects': [],
	}
}

//write annotation data 写入批注数据
function addAnnotationData(annotation_data, all_str, text_canvas, canvas_scale_x, canvas_scale_y, annotation_type,
	this_page) {
	var tips = {
		'zh-cn': [
			'添加批注',
		],
		'en': [
			'add comments',
		]
	} [tips_language];

	annotation_data.all_str = all_str; //annotation text
	var all_rect = [];
	if (annotation_type == 'highlight') {
		all_rect = getGroupRect(annotation_data.rects);
	} else {
		all_rect = getGroupRectOfUnderLine(annotation_data.rects);
	}
	//annotation data
	annotation_data.member_id = member_id;
	annotation_data.true_size = [text_canvas.width, text_canvas.height];
	annotation_data.save_scale_x = canvas_scale_x;
	annotation_data.save_scale_y = canvas_scale_y;
	annotation_data.all_rect = all_rect;
	annotation_data.type = annotation_type;
	annotation_data.comment = tips[0];
	annotation_data.page_number = parseInt(this_page.getAttribute('data-page-number'));
}

//暴露高亮信息
function postAnnotationData(annotation_data) {
	window.parent.postMessage({
		"type": 0,
		"source": "pdfjs-highlight",
		"content": annotation_data
	}, '*');
}

//process all selection <span> 处理选中的所有<span>
function getAllStrAndHighlightSpan(spans, Range, canvas_scale_x, canvas_scale_y, sel) {
	if (spans.length == 0) {
		var single_span = Range.commonAncestorContainer.parentNode;
		highlightSpan(ctx, canvas_scale_x, canvas_scale_y, single_span, true, Range.startOffset, Range.endOffset,
			false);
	} else {
		highlightSpan(ctx, canvas_scale_x, canvas_scale_y, spans[0], false, 0, 0, true);
		for (let i = 1; i < spans.length; i++) {
			highlightSpan(ctx, canvas_scale_x, canvas_scale_y, spans[i], false, 0, 0, false);
		}
	}
	var all_str = sel.toString();
	return all_str;
}

//get number from style 从 style 里面提取数字
function getNumberFromStyle(str_value, replace_str) {
	var re_text = str_value.replace(' ', '').replace('calc(var(--scale-factor)*', '').replace(replace_str + ')', '');
	var value = parseFloat(re_text);
	// console.log('数值',value);
	return value;
}

//caculate selected <span> relative position in page 计算选中 <span> 在页面中的相对位置
function highlightSpan(ctx, canvas_scale_x, canvas_scale_y, span, single_span, start_offset, end_offset, first_span) {
	var this_style = span.style;

	var left = 0.0;
	var top = 0.0;

	if (this_style.left.indexOf('%') != -1) {
		left = getNumberFromStyle(this_style.left, '%') * canvas_scale_x * true_width / 100; //原本是百分比，需要变回长度
	} else {
		//px数值
		left = getNumberFromStyle(this_style.left, 'px') * canvas_scale_x * canvas_text_scale_x;
	}


	if (this_style.top.indexOf('%') != -1) {
		top = getNumberFromStyle(this_style.top, '%') * canvas_scale_y * true_height / 100; //原本是百分比，需要变回长度
	} else {
		top = getNumberFromStyle(this_style.top, 'px') * canvas_scale_y * canvas_text_scale_y;
	}

	var height = getNumberFromStyle(this_style.fontSize, 'px') * canvas_text_scale_y * canvas_scale_y,
		offset_width = 0.0,
		width = 0.0,
		start_offset_str = '',
		metrics = '';

	var transform_list = this_style.transform.split(' ');
	var rotate = 0; //rotate angle 旋转角度
	var scaleX = 1;
	if (transform_list.length == 2) {
		//stop annoataion if there is annotation object 有旋转对象时终止批注
		rotate = parseFloat(transform_list[0].replace('rotate(', '').replace('deg)', ''));
		scaleX = parseFloat(transform_list[1].replace('scaleX(', '').replace(')', ''));
		stop_process_annotation = true;
		return;
	} else {
		scaleX = parseFloat(this_style.transform.replace('scaleX(', '').replace(')', ''));
	}

	var this_font = height + 'px' + " " + this_style.fontFamily;
	ctx.font = this_font;

	if (first_span == true) {
		var true_span = document.getElementById(span.getAttribute('id'));
		start_offset_str = true_span.innerText.replace(span.innerText, '');
		offset_width = ctx.measureText(start_offset_str).width;
	}

	if (single_span) {
		start_offset_str = span.innerText.slice(0, start_offset);
		offset_width = ctx.measureText(start_offset_str).width;
		metrics = ctx.measureText(span.innerText.slice(start_offset, end_offset));
	} else {
		metrics = ctx.measureText(span.innerText);
	}

	width = metrics.width;
	if (scaleX) {
		width = width * scaleX.toFixed(3);
		offset_width = offset_width * scaleX.toFixed(3);
	}

	//add current annotation relative position in page to page annotation list 添加当前批注相对位置到批注列表
	if (annotation_type == 'highlight') {
		drawRect(ctx, left, offset_width, top, width, height);
	} else {
		drawLine(ctx, left, offset_width, top, width, height);
	}
}

//update or delete annotation  更新或删除批注
function undoAnnotation() {
	var tips = {
		'zh-cn': [
			'当前页面所有批注已被删除!',
		],
		'en': [
			'all annotations in this page has been deleted!',
		]
	} [tips_language];

	annotation_id = PDFViewerApplication.baseUrl + '_page_' + PDFViewerApplication.page;
	readAnnotationsJson();
	if (annotations_json.length >= 1) {
		annotations_json = annotations_json.slice(0, -1);
		saveAnnotationsJson(annotation_id, annotations_json);
		// refreshCanvas();
	} else {
		alert(tips[0]);
	}
}

//edit highlight and underline text annotation 编辑高亮和下划线文本注释
function editAnnotation() {
	show_annotation_list = !show_annotation_list;
	if (show_annotation_list) {
		showAnnotationList();
	} else {
		hiddenAnnotationList();
	}
}

//show highlight and underline text annotation 展示高亮和下划线文本批注
function showAnnotationList() {
	document.getElementById('annotations_list').removeAttribute('hidden');
	var this_file_annotations = readFileAnnotations();
	createAnnotation(this_file_annotations);
}

//read all pages annotations for current file 读取当前文件所有页面的批注
function readFileAnnotations() {
	//读取文件s所有页面的注释
	// var page_count = PDFViewerApplication.pagesCount;
	// var this_file_annotations = [];
	// for (var i = 1; i <= page_count; i++) {
	// 	var this_annotatio_id = PDFViewerApplication.baseUrl + '_page_' + i;
	// 	this_page_annotation = readAnnotationsForPage(this_annotatio_id);
	// 	this_file_annotations.push(this_page_annotation);
	// }
	// return this_file_annotations;

	var page_count = PDFViewerApplication.pagesCount;
	var this_file_annotations = {};
	for (var i = 1; i <= page_count; i++) {
		var old_fabric_obj = readFabricAnnotationsForPage(i);
		if (old_fabric_obj) {
			// this_file_annotations[current_canvas_page_fabric_id]=old_fabric_obj;
			this_file_annotations[fabric_annos_id_tag + i.toString()] = old_fabric_obj;
		}
	}
	// console.log(this_file_annotations);
	return this_file_annotations;
}

//create annotation html elements list for showing 生成展示用的批注html列表元素
function createAnnotation(this_file_annotations) {
	var tips = {
		'zh-cn': [
			'关闭列表',
		],
		'en': [
			'Close List',
		]
	} [tips_language];

	var annotation_list_node = document.getElementById('annotations_list');
	annotation_list_node.innerHTML = ''; //clear children 清空所有子元素

	var parent_button = document.createElement('button'); // add hidden button 增加关闭按钮
	var outer_html =
		'<button title="close list" style="float:right;border: none;padding:2px;" id="ff-close-btn" onclick="editAnnotation()" type="button">' +
		tips[0] + '<i class="fa fa-times-circle" style="margin-left: 5px;" aria-hidden="true"></i></button>';
	parent_button.innerHTML = outer_html;
	annotation_list_node.appendChild(parent_button.childNodes[0]);

	for (var key in this_file_annotations) {
		// console.log('key', key);
		var page_number_str = key.split('-')
		var i = parseInt(page_number_str[page_number_str.length - 1]) - 1;
		var this_page_annotation = this_file_annotations[key]['page_annotations'];
		// console.log(i,this_page_annotation);

		var page_annotation_container = document.createElement('div');
		page_annotation_container.setAttribute('class', 'page-annotations');

		if (this_page_annotation.length > 0) {
			var page_annotation_title = createPageAnnotationTitle(i + 1, this_page_annotation.length);
			page_annotation_container.appendChild(page_annotation_title);

			//add specifical annotation text 添加具体标注内容
			for (var j = 0; j < this_page_annotation.length; j++) {
				var this_annotation = createOnePageAnnotation(i + 1, j + 1, this_page_annotation[j]);
				page_annotation_container.appendChild(this_annotation);
			}

			annotation_list_node.appendChild(page_annotation_container);
		}
	}
}

//deactivate button color 取消按钮的颜色
function cancelOtherButton(node) {
	var buttons = document.getElementById('firefly-annotation-buttons').getElementsByTagName('button');
	for (const button of buttons) {
		if (button.id !== node.id) {
			button.getElementsByTagName('i')[0].classList.remove('button-active');
		}
	}
}

//deactivate all buttons color 取消其他所有按钮的颜色
function cancelAllAnnotationButtons(node) {
	var buttons = document.getElementById('firefly-annotation-buttons').getElementsByTagName('button');
	for (const button of buttons) {
		if (button.id !== node.id) {
			button.getElementsByTagName('i')[0].classList.remove('button-active');
		}
	}
}

//click left annotation buttons 点击左侧批注按钮
function clickTab(node) {
	//cancel seletion close annotation 取消选择，关闭注释
	if (last_click_node_id == node.id && start_annotation) {
		node.getElementsByTagName('i')[0].classList.remove('button-active');
		start_annotation = false;
		return;
	}

	start_annotation = true;
	setFabricCanvasContainerZIndex(10);

	node.getElementsByTagName('i')[0].classList.add('button-active');
	last_click_node_id = node.id;
	var buttons = document.getElementById('firefly-annotation-buttons').getElementsByTagName('button');
	for (const button of buttons) {
		if (button.id !== node.id) {
			button.getElementsByTagName('i')[0].classList.remove('button-active');
		}
	}

	switch (node.id) {
		case "ff-highlight-btn":
			annotation_type = 'highlight';
			break;

		case "ff-underline-btn":
			annotation_type = 'underline';
			break;
		case "ff-edit-btn":
			break;

		case "ff-upload-btn":
			break;

		default:
			return;
	}
}

//create page annotation title for showing 创建展示用的页面批注title
function createPageAnnotationTitle(page_number, anno_count) {
	var tips = {
		'zh-cn': [
			'第 ',
			' 页-共 ',
			' 项',
			'收起',
			'展开',
		],
		'en': [
			'page ',
			'-',
			' annotations',
			'hide',
			'show',
		]
	} [tips_language];

	var page_annotations_title = document.createElement('div');

	var outer_html = "<div id='page-" + page_number + "-anno-title' class='page-annotations-title'>" +
		"<p style='font-size:13px;' id='page-" + page_number + "-anno-title-p'>" +
		tips[0] + page_number + tips[1] + anno_count + tips[2] +
		"</p><i id='page-" + page_number +
		"-anno-close' onclick='openOrCloseAnnotation(this)' hidden='true' title='" + tips[3] +
		"' class='fa fa-minus-square' aria-hidden='true'></i>" +
		"<i id='page-" + page_number +
		"-anno-open' onclick='openOrCloseAnnotation(this)' title='" + tips[4] +
		"' class='fa fa-plus-square' aria-hidden='true'></i></div>";
	page_annotations_title.innerHTML = outer_html;
	return page_annotations_title.childNodes[0];
}

//create page annotation for showing 创建展示用的页面批注
function createOnePageAnnotation(page_number, anno_number, anno_item) {
	var tips = {
		'zh-cn': [
			'删除',
			'复制',
			'跳转',
		],
		'en': [
			'delete',
			'copy',
			'goto',
		]
	} [tips_language];

	var this_annotation = document.createElement('div');
	var inner_html = "<div hidden='true' id='page-" + page_number + "-anno-" + anno_item.id +
		"-container' class='page-annotations-container'>" +
		"<i title='" + tips[0] +
		"' style='margin-left: 5px;' onclick='deleteAnnotation(this)' class='fa fa-trash' aria-hidden='true'></i>" +
		"<i title='" + tips[1] +
		"' style='margin-left: 5px;' onclick='copyAnnotation(this)' class='fa fa-clipboard' aria-hidden='true'></i>" +
		"<p title='" + tips[2] + "' onclick='selectAnnotation(this)'>" + anno_item.all_str + "</p>" +
		"<p id='page-" + page_number + "-anno-" + anno_item.id + "-comment'" +
		" onkeyup='inputComment(event,this)' title='enter to comfirm modify, not support blank line' contenteditable='true' style='padding:3px;background-color: #FFFFFF;margin-top:10px;height:auto;'>" +
		anno_item.comment + "</p>" +
		"</div>";

	this_annotation.innerHTML = inner_html;

	return this_annotation.childNodes[0];
}

function hiddenAnnotationList() {
	document.getElementById('annotations_list').setAttribute('hidden', true);
}

function openAnnotationFile() {
	var this_e = document.getElementById('choose_file');
	this_e.click();
}

//set annotation for current file 为当前页面设置批注
function setFileAnnotation(anno_contents) {
	fabric_list = {}; //clear all pages' Fabric layer and redraw 清空 Fabric 图层后重画
	for (var key in anno_contents) {
		// console.log('key',key);
		var page_number = key.split('-')[3];
		// set old version localstorage 设置旧版缓存
		var annotation_id = PDFViewerApplication.baseUrl + '_page_' + page_number.toString();
		var old_anno_content = JSON.stringify(anno_contents[key]['page_annotations']);
		localStorage.setItem(annotation_id, old_anno_content);

		var fabric_annotation_id = PDFViewerApplication.baseUrl + '_page_fabric_' + page_number.toString();
		var content = JSON.stringify(anno_contents[key]);
		localStorage.setItem(fabric_annotation_id, content);
		// localStorage.setItem(fabric_annotation_id, null);
	}
	//refresh annotation canvas 刷新注释画布
	refreshCanvas();
	cancelOtherButton({
		'id': 'set_file_and_fresh'
	});
	saveAllFabricData();
}

function refreshCanvas() {
	drawAllPageAnnotations();
}

//save annotation data to json 保存批注数据到 json 
function saveAnnotationsJson(annotation_id, data) {
	var content = JSON.stringify(data);
	localStorage.setItem(annotation_id, content);
	//save annotation to Fabric list 将批注保存到fabric_list中
	var split_str = annotation_id.split('_');
	var page_number = split_str[split_str.length - 1];
	// console.log('annotation_id',annotation_id);
	var page_id = fabric_annos_id_tag + page_number.toString();
	fabric_list[page_id].page_annotations = data; //record highlight and underline data 记录高亮下划线等内容
	saveFabricCanvas(page_number);
}

//save all Fabric layers data 保存所有 Fabric 页面数据
function saveAllFabricData() {
	for (var key in fabric_list) {
		var page_number = key.split('-')[3];
		saveFabricCanvas(page_number);
	}
}

//save Fabric data to localStorage(limit file size 5MB) 保存fabric数据到缓存，大小不能超过 5MB
function saveFabricCanvas(page_number) {
	var tips = {
		'zh-cn': [
			'页面超过5M大小，保存失败，请删除图片等内容',
		],
		'en': [
			'page annotation beyond 5M, save failed, please delete some image',
		]
	} [tips_language];
	var page_id = fabric_annos_id_tag + page_number.toString();
	var fabric_annotation_id = PDFViewerApplication.baseUrl + '_page_fabric_' + page_number.toString();

	var saved_data = fabric_list[page_id];
	saved_data['page_canvas']['fabric_canvas_json'] = saved_data['page_canvas']['fabric_canvas'].toJSON(
		custom_attr);

	var content = JSON.stringify(saved_data);
	try {
		localStorage.setItem(fabric_annotation_id, content);
	} catch (e) {
		alert(tips[0]);
	}
}


//output annotations and download to .json file 导出批注数据并保存为 .json 文件
function outputAnnotations() {
	saveAllFabricData();

	var is_url = judgeUrl(PDFViewerApplication.baseUrl);
	var file_name = '';
	if (is_url == true) {
		file_name = localStorage.getItem('current_anno_pdf_name');
	} else {
		file_name = PDFViewerApplication.baseUrl;
	}

	var this_file_annotations = readFileAnnotations();
	// console.log('this_file_annotations',fabric_list);

	// var new_out_put_annotation = {};
	// for (var key in this_file_annotations) {
	// 	new_out_put_annotation[key] = this_file_annotations[key];
	// 	new_out_put_annotation[key]['page_canvas']['fabric_canvas_json'] = this_file_annotations[key]['page_canvas'][
	// 		'fabric_canvas'
	// 	].toJSON(custom_attr);
	// }

	var content = JSON.stringify(this_file_annotations);
	var blob = new Blob([content], {
		type: "application/json;charset=utf-8"
	});
	var time_stamp = new Date().getTime().toString();
	saveAs(blob, file_name + ".json");
}

//down highlight and underline text to .txt file 下载高亮和下划线文字到 .txt
function downloadAnnotations() {
	var tips = {
		'zh-cn': [
			'[页码 ',
			'添加批注',
			'添加评论',
		],
		'en': [
			'[page ',
			'add comments',
			'comment',
		]
	} [tips_language];

	var this_file_annotations = readFileAnnotations();
	var is_url = judgeUrl(PDFViewerApplication.baseUrl);
	var file_name = '';
	if (is_url == true) {
		file_name = localStorage.getItem('current_anno_pdf_name');
	} else {
		file_name = PDFViewerApplication.baseUrl;
	}

	var down_str = '';
	for (var key in this_file_annotations) {
		var i = key.split('-')[3];
		var this_page_anno = this_file_annotations[key]['page_annotations'];

		if (this_page_anno.length > 0) {
			down_str += tips[0] + i + ']\r\n';
			for (var j = 0; j < this_page_anno.length; j++) {
				var this_anno = this_page_anno[j];
				if (this_anno['comment'] != tips[1] && this_anno['comment'] != tips[2]) {
					down_str += this_anno['all_str'] + '\r\n' + this_anno['comment'] + '\r\n\n';
				} else {
					down_str += this_anno['all_str'] + '\r\n\n';
				}
			}
			down_str += '\r\n';
		}
	}

	var blob = new Blob([down_str]);
	saveAs(blob, file_name + ".txt");
}

//judge current pdf file is from url or not 判断当前文档是否为 URL 形式加载的 pdf
function judgeUrl(URL) {
	var str = URL;
	var Expression = /http(s)?:\/\/([\w-]+\.)+[\w-]+(\/[\w- .\/?%&=]*)?/;
	var objExp = new RegExp(Expression);
	if (objExp.test(str) == true) {
		return true;
	} else {
		return false;
	}
}

//read annotation to json 读取json格式的
function readAnnotationsJson() {
	// annotation_id = PDFViewerApplication.baseUrl + '_page_' + PDFViewerApplication.page;
	annotations_json = readAnnotationsForPage(annotation_id);
}

//read one page annotation [highlight/underline] data. 读取某个页面的批注数据[高亮/下划线]
function readAnnotationsForPage(annotation_id) {
	var this_page_annotation = [];
	if (localStorage.getItem(annotation_id) !== null) {
		this_page_annotation = JSON.parse(localStorage.getItem(annotation_id));
		for (var i = 0; i < this_page_annotation.length; i++) {
			if (Object.prototype.hasOwnProperty.call(this_page_annotation[i], 'id') == false || this_page_annotation[i]
				.id == null) {
				this_page_annotation[i].id = buildId(i + 1);
			}
		}
	} else {
		this_page_annotation = [];
	}
	return this_page_annotation;
}

//read one Fabric page annotations  读取页面的 Fabric 批注
function readFabricAnnotationsForPage(page_number) {
	var this_page_id = PDFViewerApplication.baseUrl + '_page_fabric_' + page_number.toString();
	var this_page_annotation = null;
	if (localStorage.getItem(this_page_id) !== null) {
		this_page_annotation = JSON.parse(localStorage.getItem(this_page_id));
		if (this_page_annotation['page_canvas']['fabric_canvas_json']['objects'].length == 0) {
			return null;
		}
	}
	return this_page_annotation;
}

// Draws the rectangle and saves the final data to a Fabric object 绘制矩形并且把最终数据保存到 Fabric 对象中
function drawRect(ctx, left, offset_width, top, width, height) {
	//不绘制，而是触发pdf.js的绘制
	// ctx.fillStyle ="rgba(255, 205, 0,0.3)";
	// ctx.fillRect(left+offset_width,top,width,height);
	// console.log('标注时刻起点',left+offset_width);
	// console.log('五要素',left,offset_width, top, width, height);

	var scale_left = (left + offset_width) / true_width.toFixed(8),
		scale_top = top / true_height.toFixed(8),
		scale_width = width / true_width.toFixed(8),
		scale_height = height / true_height.toFixed(8);

	var scale_rect = [scale_left, scale_top, scale_width, scale_height];
	// Proportional position of the current rectangle on the canvas,scale_rect; Add it to the rectangle
	//'当前矩形在canvas中的比例位置',scale_rect;添加到矩形中去
	annotation_data.rects.push(scale_rect);
}

//draw underline 绘制下划线
function drawLine(ctx, left, offset_width, top, width, height) {
	var x1 = left + offset_width,
		y1 = top + height,
		x2 = left + offset_width + width,
		y2 = top + height;

	// //不绘制，而是想办法触发pdf.js里面的绘制
	// ctx.moveTo(x1,y1);//线条开始位置
	// ctx.lineTo(x2,y2);//线条经过点
	// ctx.lineWidth = 4;//设置线条宽度
	// ctx.strokeStyle = "blue";//设置线条颜色
	// ctx.stroke();//用于绘制线条

	//Add the two points of the line to the rects 将线条两个点加入rects中
	annotation_data.rects.push([x1 / true_width, y1 / true_height, x2 / true_width, y2 / true_height]);
}

//caculate group rect of all highlight rects 计算所有高亮 rects 的最外围矩形范围
function getGroupRect(rects) {
	//Because it's proportional, so min_x,min_y are both going to be less than 2
	//因为是比例，所以min_x,min_y都会比2小
	var min_x = 2,
		min_y = 2,
		max_x = 0,
		max_y = 0;

	for (var i = 0; i < rects.length; i++) {
		var scale_rect = rects[i];
		var box_left = scale_rect[0],
			box_top = scale_rect[1],
			box_width = scale_rect[2],
			box_height = scale_rect[3];

		var this_min_x = box_left,
			this_max_y = box_top + box_height,
			this_max_x = box_left + box_width,
			this_min_y = box_top;

		min_x = Math.min(min_x, this_min_x);
		max_x = Math.max(max_x, this_max_x);
		min_y = Math.min(min_y, this_min_y);
		max_y = Math.max(max_y, this_max_y);
	}

	return [min_x, min_y, max_x - min_x, max_y - min_y];
}

//caculate group rect of all underline rects 计算所有下划线 rects 的最外围矩形范围
function getGroupRectOfUnderLine(rects) {
	var min_x = 2,
		min_y = 2,
		max_x = 0,
		max_y = 0;

	for (var i = 0; i < rects.length; i++) {
		var scale_rect = rects[i];
		var x1 = scale_rect[0],
			y1 = scale_rect[1],
			x2 = scale_rect[2],
			y2 = scale_rect[3];

		min_x = Math.min(min_x, x1);
		max_x = Math.max(max_x, x2);
		min_y = Math.min(min_y, y1);
		max_y = Math.max(max_y, y2);
	}

	//The maximum range rectangle is built after the four maximum values are obtained
	//获得到四个最值之后构建最大范围矩形
	return [min_x, min_y, max_x - min_x, max_y - min_y];
}

//open or close highlight and underline annotations list 展开或关闭高亮及下划线列表
function openOrCloseAnnotation(node) {
	var id_split = node.id.split('-');
	if (id_split[id_split.length - 1] == 'close') {
		document.getElementById(node.id.replace('close', 'open')).removeAttribute('hidden');
		openAnnotations(node, false);
	} else {
		document.getElementById(node.id.replace('open', 'close')).removeAttribute('hidden');
		openAnnotations(node, true);
	}
	node.setAttribute('hidden', 'true');
}

//open highlight and underline annotations list 展开高亮及下划线列表
function openAnnotations(node, open) {
	var parent_node = node.parentNode;
	var brother_node = parent_node.parentNode.childNodes;
	for (var i = 0; i < brother_node.length; i++) {
		if (brother_node[i].id && brother_node[i].id != parent_node.id) {
			if (open) {
				document.getElementById(brother_node[i].id).removeAttribute('hidden');
			} else {
				document.getElementById(brother_node[i].id).setAttribute('hidden', true);
			}
		}
	}
}

// click annotation and navigate to target page 点击批注后跳转到批注所在页面
function selectAnnotation(node) {
	var node_id = node.parentNode.getAttribute('id');
	var page_number = node_id.split('-')[1];
	PDFViewerApplication.page = parseInt(page_number);
}

//copy annotation text 复制批注文本
function copyAnnotation(node) {
	var tips = {
		'zh-cn': [
			'添加批注',
			'添加评论',
		],
		'en': [
			'add comments',
			'comment',
		]
	} [tips_language];

	var parent_node = node.parentNode;
	var text = parent_node.innerText;
	if (text.split('\n')[2] == tips[0] || text.split('\n')[2] == tips[1]) {
		text = text.split('\n')[0];
	}

	if (post_to_parent == true) {
		window.parent.postMessage({
			"type": 4,
			"source": "pdfjs",
			"content": text
		}, '*');
	} else {
		copyText(text);
	}
}

//copy text 复制文本
function copyText(text) {
	var tips = {
		'zh-cn': [
			'复制成功！',
		],
		'en': [
			'Copied!',
		]
	} [tips_language];

	// number cannot be executed without.length. selectText must be converted to a string
	// 数字没有 .length 不能执行selectText 需要转化成字符串
	const textString = text.toString();
	let input = document.querySelector('#copy-input');
	if (!input) {
		input = document.createElement('input');
		input.id = "copy-input";
		input.readOnly = "readOnly"; // Prevents ios focus from triggering keyboard events 防止ios聚焦触发键盘事件
		input.style.position = "absolute";
		input.style.left = "-2000px";
		input.style.zIndex = "-2000";
		document.body.appendChild(input)
	}

	input.value = textString;
	selectText(input, 0, textString
		.length
	); // ios requires text to be selected first and does not support input.select(); ios必须先选中文字且不支持 input.select();
	if (document.execCommand('copy')) {
		document.execCommand('copy');
		alert(tips[0]);
	}
	input.blur();

	//// input's built-in select() method does not work on the Apple side, so you need to write a similar method to select text. createTextRange(setSelectionRange) is the input method
	// input自带的select()方法在苹果端无法进行选择，所以需要自己去写一个类似的方法选择文本。createTextRange(setSelectionRange)是input方法
	function selectText(textbox, startIndex, stopIndex) {
		if (textbox.createTextRange) { //ie
			const range = textbox.createTextRange();
			range.collapse(true);
			range.moveStart('character', startIndex); //start index 起始光标
			range.moveEnd('character', stopIndex - startIndex); //end index 结束光标
			range.select(); // Not compatible with ios
		} else { //firefox/chrome
			textbox.setSelectionRange(startIndex, stopIndex);
			textbox.focus();
		}
	}
}

//delete annotation 删除批注
function deleteAnnotation(node) {
	var tips = {
		'zh-cn': [
			'第 ',
			' 页-共 ',
			' 项',
		],
		'en': [
			'page ',
			'-',
			' annotations',
		]
	} [tips_language];

	//delete html element 删除html元素
	var parent_node = node.parentNode;
	var grand_node = parent_node.parentNode;
	var this_annotations_json = updateAnnotationComent('', parent_node.id, 'delete_annotation');

	var page_num = parent_node.id.split('-')[1];
	var title_id = 'page-' + page_num + '-anno-' + 'title-p';
	var this_title = document.getElementById(title_id);
	this_title.innerText = tips[0] + page_num + tips[1] + this_annotations_json.length + tips[2];
	// this_title.innerText=''
	// Delete the page annotation list when there is only one element 只有一个元素时删除该页列表
	grand_node.removeChild(parent_node);
	if (this_annotations_json.length == 0) {
		grand_node.parentNode.removeChild(grand_node);
	}
	// refreshCanvas();
}

//input comment for highlight and underline text   为高亮和下划线批注增加评论
function inputComment(evt, node) {
	var theEvent = evt || window.event || arguments.callee.caller.arguments[0]; //兼容IE、FF、Google
	if (theEvent.keyCode == 13) {
		node.blur();
		//enter to save 回车后保存
		node.innerHTML = node.innerHTML.replace('<br>', '');
		// console.log('注释id',node.id);
		var this_annotations_json = updateAnnotationComent(node.innerText, node.id, 'update_comment');
	}
}

//get annotation number from annotatioin id  从 annotation id 中获取批注的编号
function getAnnoNumber(annotations_data, anno_id) {
	for (var i = 0; i < annotations_data.length; i++) {
		if (annotations_data[i].id == anno_id) {
			return i;
		}
	}
	return null;
}

// update highlight and underline annotation comment 更新批注和下划线评论
function updateAnnotationComent(new_comment, full_anno_id, op) {
	// console.log('id',full_anno_id);
	var infos = full_anno_id.split('-');
	// console.log('id划分后',infos);
	var this_annotation_id = PDFViewerApplication.baseUrl + '_page_' + infos[1];
	var this_annotations_json = readAnnotationsForPage(this_annotation_id);
	var anno_id = infos[3];
	var anno_number = getAnnoNumber(this_annotations_json, anno_id);
	if (op == 'update_comment') {
		this_annotations_json[anno_number].comment = new_comment;
	} else {
		this_annotations_json.splice(anno_number, 1);
		//Delete annotation objects on the fabric layer after they are deleted 删除注释对象后在fabric层上清除对象
		deleteFabricObjByID(infos[1], anno_id);
	}
	saveAnnotationsJson(this_annotation_id, this_annotations_json);
	// showAnnotationList();
	return this_annotations_json;
}

//build annotation id 构建批注id
function buildId(id_number) {
	var this_time = new Date().getTime();
	var id = this_time + '_' + id_number;
	return id;
}

//draw all pages annotations when refresh 刷新页面的绘制所有页面的批注
function drawAllPageAnnotations() {
	var viewerConinter = document.getElementById('viewerContainer');
	var old_scroll_left = viewerConinter.scrollLeft;
	var old_scroll_top = viewerConinter.scrollTop;

	var canvas_wrappers = document.getElementsByClassName('canvasWrapper');
	for (var c = 0; c < canvas_wrappers.length; c++) {
		drawOnepageAnnotation(canvas_wrappers[c]);
		// addIdForTextLayerSpan(canvas_wrappers[c].parentNode);
	}

	viewerConinter.scrollLeft = old_scroll_left;
	viewerConinter.scrollTop = old_scroll_top;
}

// old function for draw all pages annotations when refresh 刷新页面的绘制所有页面的批注(旧函数)
function old_drawOnepageAnnotation(this_wrapper) {
	var canvas = this_wrapper.children[0];
	var page_number = this_wrapper.parentNode.getAttribute('data-page-number');

	var old_my_anno_divs = this_wrapper.parentNode.getElementsByClassName('myAnnotationsLayer');
	for (var o = 0; o < old_my_anno_divs.length; o++) {
		this_wrapper.parentNode.removeChild(old_my_anno_divs[o]);
	}

	var anno_div = document.createElement("div");
	anno_div.classList.add('myAnnotationsLayer');
	var anno_canvas = document.createElement("canvas");
	anno_canvas.setAttribute('id', fabric_annos_id_tag + page_number);
	anno_div.appendChild(anno_canvas);
	this_wrapper.parentNode.appendChild(anno_div);

	anno_canvas.width = canvas.width;
	anno_canvas.height = canvas.height;
	anno_canvas.style.width = canvas.style.width;
	anno_canvas.style.height = canvas.style.height;
	anno_canvas.classList.add('anno-canvas');

	var anno_ctx = anno_canvas.getContext("2d");
	// anno_ctx.globalAlpha = 0.4;
	var width = canvas.width;
	var height = canvas.height;
	var current_canvas_page_id = PDFViewerApplication.baseUrl + '_page_' + page_number;
	var annotations_json = JSON.parse(localStorage.getItem(
		current_canvas_page_id));
	if (annotations_json != null && annotations_json.length > 0) {
		for (var j = 0; j < annotations_json.length; j++) {
			var this_annotation = annotations_json[j];
			var all_rects = this_annotation.rects;
			for (var i = 0; i < all_rects.length; i++) {
				var scale_rect = all_rects[i];
				var box_left = scale_rect[0],
					box_top = scale_rect[1],
					box_width = scale_rect[2],
					box_height = scale_rect[3];

				var save_width = this_annotation.true_size[0];
				var save_height = this_annotation.true_size[1];

				var scale_x = width / save_width / this_annotation
					.save_scale_x;
				var scale_y = height / save_height / this_annotation
					.save_scale_y;

				var new_left = (box_left * save_width * scale_x)
					.toFixed(3);
				var new_top = (box_top * save_height * scale_y).toFixed(
					3);
				var new_width = (box_width * save_width * scale_x)
					.toFixed(3);
				var new_height = (box_height * save_height * scale_y)
					.toFixed(3);

				if (this_annotation.type == 'highlight') {
					anno_ctx.clearRect(new_left, new_top, new_width,
						new_height);
					anno_ctx.fillStyle = "rgba(255, 237, 0,0.3)";
					anno_ctx.fillRect(new_left, new_top, new_width,
						new_height);

				} else {
					anno_ctx.moveTo(new_left, new_top);
					anno_ctx.lineTo(new_width, new_height);
					anno_ctx.lineWidth = 5;
					anno_ctx.strokeStyle = "rgba(57, 181, 74,1)";
					anno_ctx.stroke();
				}
			}
		}
	}

	if (add_water_mark == true) {
		anno_ctx.font = "bold " + parseInt(width / 16) + "px Georgia";
		anno_ctx.fillStyle = "#955f17"
		anno_ctx.textAlign = "center"
		anno_ctx.fillText("https://demos.libertynlp.com", width / 2, height / 2);
	}
}

//add id for textLayer <span> 给textLayer的span元素增加id
function addIdForTextLayerSpan(page_div) {
	var page_number = page_div.getAttribute('data-page-number');
	var text_layer = page_div.getElementsByClassName('textLayer')[0];
	if (text_layer == null) {
		return;
	}

	var spans = text_layer.getElementsByTagName('span');
	if (spans.length == 0) {
		return;
	}

	for (var i = 0; i < spans.length; i++) {
		if (spans[i].hasAttribute('id') == false) {
			var span_id = 'page-' + page_number + '-textspan-' + (i + 1);
			spans[i].setAttribute('id', span_id);
		}
	}
}

// write all Fabric layer annotations to pdf file  将 Fabric 批注写入到 pdf 文件中
async function modifyPdf(blobUrl) {
	var tips = {
		'zh-cn': [
			'初始化: ',
			'写入文件: ',
			'下载准备中...',
		],
		'en': [
			'Initial: ',
			'Write File: ',
			'Preparing for download...',
		]
	} [tips_language];
	showDownloadLog(tips[2]);
	// increase();
	var no_annotation = true;
	var file_annotation = readFileAnnotations();

	if (file_annotation == {}) {
		closeDownloadLog();
		return blobUrl;
	}

	// URL for request URL是要请求的地址
	var existingPdfBytes = await fetch(blobUrl).then(res => res
		.arrayBuffer());
	var pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
	var pages = pdfDoc.getPages();

	var pages_imgs = [];
	var canvas_scale = 1;
	for (var j = 0; j < pages.length; j++) {
		var img = await drawCanvasForDownload(pages[j], j + 1, canvas_scale);
		if (img != null) {
			var eleImgCover = await pdfDoc.embedPng(img);
			pages_imgs.push(eleImgCover);
		} else {
			pages_imgs.push(null);
		}
	}

	var i = 0;
	pages.forEach(item => {
		var this_img = pages_imgs[i];
		var page_width = item.getSize().width;
		var page_height = item.getSize().height;
		if (this_img != null) {
			var this_scale = this_img.width / page_width;
			item.drawImage(this_img, {
				x: 0,
				y: 0,
				width: this_img.width / this_scale,
				height: this_img.height / this_scale,
			});

			if (add_water_mark == true) {
				item.drawText('https://demos.libertynlp.com', {
					x: 0,
					y: page_height / 2,
					size: 40,
					color: PDFLib.rgb(0, 0, 0),
				})
			}
		}
		i = i + 1;
	})
	
	var pdfBuffer = await pdfDoc.save();
	const arraybuffer = new Int8Array(pdfBuffer);
	const new_blobUrl = URL.createObjectURL(new Blob([arraybuffer], {
		type: "application/pdf"
	}));
	closeDownloadLog();
	return new_blobUrl;
}

//upload annotation 上传标注
function uploadAnnotation() {
	var tips = {
		'zh-cn': [
			'本地文档不支持云端标注\n\n启用云端同步标注功能并导入本地标注的步骤：\n① 导出当前标注 (json格式)\n② 在 "文献管理" 模块上传文献\n③ 在 "文献管理" 模块点击文件名从云端加载文献\n④ 导入标注 (json格式) '
		],
		'en': [
			'Local pdf not support cloud annotations\n\nsteps for enable cloud annotation：\n① outpue current annotation (json)\n② upload file\n③ load file from cloud\n④ import annotations (json) '
		]
	} [tips_language];

	var is_url = judgeUrl(PDFViewerApplication.baseUrl);
	if (is_url == false) {
		alert(tips[0]);
		return;
	}
	file_name = localStorage.getItem('current_anno_pdf_name');

	var this_file_annotations = readFileAnnotations();
	var upload_data = {
		'pdf_name': file_name,
		'pdf_url': PDFViewerApplication.baseUrl,
		'anno_content': this_file_annotations,
	}
	window.parent.postMessage({
		"type": 3,
		"source": "pdfjs",
		"content": upload_data
	}, '*');
}

// synchronization annotation from cloud 同步云端批注
function menuSearchAnnotation() {
	var tips = {
		'zh-cn': [
			'本地文档不支持云端标注\n\n启用云端同步标注功能并导入本地标注的步骤：\n① 导出当前标注 (json格式)\n② 在 "文献管理" 模块上传文献\n③ 在 "文献管理" 模块点击文件名从云端加载文献\n④ 导入标注 (json格式) '
		],
		'en': [
			'Local pdf not support cloud annotations\n\nsteps for enable cloud annotation：\n① outpue current annotation (json)\n② upload file\n③ load file from cloud\n④ import annotations (json) '
		]
	} [tips_language];

	var is_url = judgeUrl(PDFViewerApplication.baseUrl);
	if (is_url == false) {
		alert(tips[0]);
		return;
	}
	window.parent.postMessage({
		"type": 5,
		"source": "pdfjs",
		"content": PDFViewerApplication.baseUrl
	}, '*');
}

// download pdf 下载pdf
function myDownLoad() {
	PDFViewerApplication.downloadOrSave();
}

//hide download dialog  隐藏下载提示框
function closeDownloadLog() {
	let el = document.getElementById("my-download-process-div");
	el.style.top = '-50px';
	el.setAttribute('hidden', true);
}

//show download dialog  显示下载提示框
function showDownloadLog(log_str) {
	// console.log(log_str);
	let el = document.getElementById("my-download-process-div");
	el.style.top = '150px';
	el.removeAttribute('hidden');

	var log_div = document.getElementById('my-download-process-log');
	log_div.innerText = '';
	log_div.innerText = log_str;
}

// draw canvas and convert to pdf 绘制批注到 canvas 并转换为 png
async function drawCanvasForDownload(item, page_number, scale) {
	var old_fabric_obj = readFabricAnnotationsForPage(page_number);
	if (old_fabric_obj) {
		var width = parseFloat(old_fabric_obj.page_canvas.width);
		var height = parseFloat(old_fabric_obj.page_canvas.height);

		var anno_canvas = document.createElement("canvas");
		anno_canvas.width = width;
		anno_canvas.height = height;
		var page_id = fabric_annos_id_tag + 'for-download-' + page_number.toString();
		anno_canvas.setAttribute('id', page_id);

		var canvas_container = document.getElementById('div-for-download-canvas');
		canvas_container.appendChild(anno_canvas);

		var this_fabric_canvas = new fabric.Canvas(page_id, {
			includeDefaultValues: true, 
			isDrawingMode: false, 
			fireRightClick: true, 
			stopContextMenu: false, 
			backgroundColor: 'rgba(255, 255, 255, 0)',
		});

		function loadImageFabricCanvas() {
			return new Promise(resolve => {
				this_fabric_canvas.loadFromJSON(old_fabric_obj.page_canvas.fabric_canvas_json,
					function() {
						var this_canvas = document.getElementById(page_id);
						var pic_url = this_canvas.toDataURL('image/png');
						canvas_container.innerHTML = ''; 
						resolve(pic_url); 
					});
			})
		}

		let this_pic_url = await loadImageFabricCanvas();
		return this_pic_url;
	}
	return null;
}

//old function for draw canvas and download   绘制 canvas 并下载的旧函数
function old_drawCanvasForDownload(item, page_number, scale) {
	var {
		width,
		height
	} = item.getSize()
	width = width * scale;
	height = height * scale;
	var anno_canvas = document.createElement("canvas");
	anno_canvas.width = width;
	anno_canvas.height = height;

	var anno_ctx = anno_canvas.getContext("2d");

	var current_canvas_page_id = PDFViewerApplication.baseUrl + '_page_' + page_number;
	var annotations_json = JSON.parse(localStorage.getItem(
		current_canvas_page_id));
	if (annotations_json != null && annotations_json.length > 0) {
		for (var j = 0; j < annotations_json.length; j++) {
			var this_annotation = annotations_json[j];
			var all_rects = this_annotation.rects;
			for (var i = 0; i < all_rects.length; i++) {
				var scale_rect = all_rects[i];
				var box_left = scale_rect[0],
					box_top = scale_rect[1],
					box_width = scale_rect[2],
					box_height = scale_rect[3];

				var save_width = this_annotation.true_size[0];
				var save_height = this_annotation.true_size[1];

				var scale_x = width / save_width / this_annotation
					.save_scale_x;
				var scale_y = height / save_height / this_annotation
					.save_scale_y;

				var new_left = (box_left * save_width * scale_x)
					.toFixed(3);
				var new_top = (box_top * save_height * scale_y).toFixed(
					3);
				var new_width = (box_width * save_width * scale_x)
					.toFixed(3);
				var new_height = (box_height * save_height * scale_y)
					.toFixed(3);

				if (this_annotation.type == 'highlight') {
					anno_ctx.clearRect(new_left, new_top, new_width,
						new_height);
					anno_ctx.fillStyle = "rgba(255, 237, 0,0.3)";
					anno_ctx.fillRect(new_left, new_top, new_width,
						new_height);
				} else {
					anno_ctx.moveTo(new_left, new_top);
					anno_ctx.lineTo(new_width, new_height);
					anno_ctx.lineWidth = 1 * scale;
					anno_ctx.strokeStyle = "rgba(57, 181, 74,1)";
					anno_ctx.stroke();
				}
			}
		}

		if (add_water_mark == true) {
			anno_ctx.font = "bold " + parseInt(width / 16) + "px Georgia";
			anno_ctx.fillStyle = "#955f17"
			anno_ctx.textAlign = "center"
			anno_ctx.fillText("https://demos.libertynlp.com", width / 2, height / 2);
		}

		//返回canvas
		return anno_canvas.toDataURL('image/png');
	}

	//没有批注时返回空
	return null
}

// draw one page annotation  绘制单页的批注
function drawOnepageAnnotation(this_wrapper) {
	// console.log(this_wrapper);
	var canvas = this_wrapper.children[0];
	var page_number = this_wrapper.parentNode.getAttribute('data-page-number');

	var this_fabric_obj = getFabricObj(page_number);
	// console.log('this_fabric_obj', this_fabric_obj);
	if (this_fabric_obj) {
		loadOldFabricObj(this_wrapper, this_fabric_obj);
	} else {
		drawAnnotationOnFabricPageFirstTime(this_wrapper, page_number);
	}
}

//load Fabric data 加载Fabric批注数据
function loadOldFabricObj(this_wrapper, this_fabric_obj) {
	var canvas_container = this_wrapper.parentNode.getElementsByClassName('canvas-container');
	if (canvas_container.length != 0) {
		this_wrapper.parentNode.removeChild(canvas_container[0]);
	}
	// console.log(this_fabric_obj);
	var canvas = this_wrapper.children[0];
	var width = parseInt(canvas.style.width.replace('px', ''));
	var height = parseInt(canvas.style.height.replace('px', ''));

	this_fabric_obj.page_canvas_container.style.width = width + 'px';
	this_fabric_obj.page_canvas_container.style.height = height + 'px';

	this_fabric_obj.page_canvas_container.children[0].style.width = width + 'px';
	this_fabric_obj.page_canvas_container.children[0].style.height = height + 'px';

	this_fabric_obj.page_canvas_container.children[1].style.width = width + 'px';
	this_fabric_obj.page_canvas_container.children[1].style.height = height + 'px';

	if (fabric_top == true) {
		this_fabric_obj.page_canvas_container.style.zIndex = 100;
	} else {
		this_fabric_obj.page_canvas_container.style.zIndex = 10;
	}

	this_wrapper.parentNode.insertBefore(this_fabric_obj.page_canvas_container, this_wrapper.parentNode.children[0]);
}

// draw annotation on Fabric layer first time 首次在 Fabric图层上绘制批注
function drawAnnotationOnFabricPageFirstTime(this_wrapper, page_number) {
	// var anno_ctx = document.getElementById(page_id).getContext("2d"); //用于清空重复区域
	var canvas_container = this_wrapper.parentNode.getElementsByClassName('canvas-container');
	if (canvas_container.length != 0) {
		this_wrapper.parentNode.removeChild(canvas_container[0]);
	}

	var anno_canvas = document.createElement("canvas");
	var page_id = fabric_annos_id_tag + page_number;
	anno_canvas.setAttribute('id', page_id);
	this_wrapper.parentNode.insertBefore(anno_canvas, this_wrapper.parentNode.children[0]);

	var old_fabric_obj = readFabricAnnotationsForPage(page_number);
	if (old_fabric_obj) {
		var width = parseFloat(old_fabric_obj.page_canvas.width);
		var height = parseFloat(old_fabric_obj.page_canvas.height);
	} else {
		var canvas = this_wrapper.children[0];
		var width = parseInt(canvas.style.width.replace('px', ''));
		var height = parseInt(canvas.style.height.replace('px', ''));
	}

	anno_canvas.width = width;
	anno_canvas.height = height;
	anno_canvas.style.width = width + 'px';
	anno_canvas.style.height = height + 'px';
	anno_canvas.classList.add('anno-canvas');

	var this_fabric_canvas = new fabric.Canvas(page_id, {
		includeDefaultValues: false, // false表示仅保存简易信息
		isDrawingMode: free_draw, // 开启绘图模式 tru or false
		fireRightClick: true, // 启用右键，button的数字为3
		stopContextMenu: false, // 禁止默认右键菜单
		backgroundColor: 'rgba(255, 255, 255, 0)',
	});

	var this_fabric_canvas_container = this_wrapper.parentNode.children[0];
	if (fabric_top == true) {
		this_fabric_canvas_container.style.zIndex = 100;
	} else {
		this_fabric_canvas_container.style.zIndex = 10;
	}

	this_fabric_canvas.on('mouse:up', fabricMouseUp);

	this_fabric_canvas.freeDrawingBrush.color = default_brush_color;
	this_fabric_canvas.freeDrawingBrush.width = default_brush_width;
	this_fabric_canvas.freeDrawingBrush.limitedToCanvasSize = true;

	if (old_fabric_obj) {
		this_fabric_canvas.loadFromJSON(old_fabric_obj.page_canvas.fabric_canvas_json, function() {
			fabric_list[page_id] = {
				'page_id': page_id,
				'page_canvas_container': this_fabric_canvas_container,
				'page_annotations': old_fabric_obj.page_annotations, //current annotation data 当前页面的批注内容
				'page_canvas': {
					'fabric_canvas': this_fabric_canvas,
					'width': width,
					'height': height,
					'fabric_canvas_json': this_fabric_canvas.toJSON(custom_attr),
				},
			};
			loadOldFabricObj(this_wrapper, fabric_list[page_id]);
			saveAllFabricData();
		});
	} else {
		var current_canvas_page_id = PDFViewerApplication.baseUrl + '_page_' + page_number;
		var annotations_json = readAnnotationsForPage(current_canvas_page_id);
		if (annotations_json != null && annotations_json.length > 0) {
			for (var j = 0; j < annotations_json.length; j++) {
				var this_annotation = annotations_json[j];
				drawOnFabric(this_annotation, this_fabric_canvas, this_wrapper);
			}
		}
		fabric_list[page_id] = {
			'page_id': page_id,
			'page_canvas_container': this_fabric_canvas_container,
			'page_annotations': annotations_json, //current annotation data 当前页面的批注内容
			'page_canvas': {
				'fabric_canvas': this_fabric_canvas,
				'width': width,
				'height': height,
				'fabric_canvas_json': this_fabric_canvas.toJSON(custom_attr),
			},
		};
		saveAllFabricData();
	}
}

// add annotation to fabric 将批注添加到 fabric
function addAnnotationToFabric(this_annotation, this_page) {
	// console.log('绘制对象',this_annotation);
	var this_page_number = this_annotation.page_number;
	var pages = document.getElementsByClassName('page');
	this_page = pages[this_page_number - 1];

	var this_fabric_obj = getFabricObj(this_annotation.page_number);
	var this_wrapper = this_page.getElementsByClassName('canvasWrapper')[0];
	if (this_fabric_obj) {
		drawOnFabric(this_annotation, this_fabric_obj.page_canvas.fabric_canvas, this_wrapper);
	} else {
		drawAnnotationOnFabricPageFirstTime(this_wrapper, this_annotation.page_number);
	}
}

//get all fabric layer objects  获取所有 Fabric 页面对象
function getFabricObj(page_number) {
	var page_id = fabric_annos_id_tag + page_number.toString();
	return fabric_list[page_id];
}

//draw annotation on Fabric layer 在 Fabric 层上绘制批注
function drawOnFabric(this_annotation, this_fabric_canvas, this_wrapper) {
	var canvas = this_wrapper.children[0];
	var width = parseInt(this_fabric_canvas.width);
	var height = parseInt(this_fabric_canvas.height);

	var group_list = [];

	var all_rects = this_annotation.rects;
	var save_width = this_annotation.true_size[0];
	var save_height = this_annotation.true_size[1];

	var scale_x = width / save_width / this_annotation
		.save_scale_x;
	var scale_y = height / save_height / this_annotation
		.save_scale_y;

	var point_num = 3;
	for (var i = 0; i < all_rects.length; i++) {
		var scale_rect = all_rects[i];
		var box_left = scale_rect[0],
			box_top = scale_rect[1],
			box_width = scale_rect[2],
			box_height = scale_rect[3];

		if (box_left == null || box_top == null || box_width == null || box_height == null) {
			continue;
		}

		var new_left = parseFloat((box_left * save_width * scale_x)
			.toFixed(point_num));
		var new_top = parseFloat((box_top * save_height * scale_y).toFixed(
			point_num));
		var new_width = parseFloat((box_width * save_width * scale_x)
			.toFixed(point_num));
		var new_height = parseFloat((box_height * save_height * scale_y)
			.toFixed(point_num));

		if (this_annotation.type == 'highlight') {
			var rect = new fabric.Rect({
				top: new_top,
				left: new_left,
				width: new_width,
				height: new_height,
				fill: default_highlight_color,
			})
			group_list.push(rect);
			// this_fabric_canvas.renderAll();
		} else {
			var line = new fabric.Line(
				[
					new_left, new_top, //start position 起始点坐标
					new_width, new_top //end position 结束点坐标
				], {
					stroke: default_underline_color, //brush color 笔触颜色
					strokeWidth: default_underline_width, //brush width 笔触宽度
				}
			)
			// this_fabric_canvas.add(line);
			group_list.push(line);
		}
	}

	var this_opacity = 1;
	if (this_annotation.type == 'highlight') {
		this_opacity = 0.3;
	}

	var all_left = parseFloat((this_annotation.all_rect[0] * save_width * scale_x)
		.toFixed(point_num));
	var all_top = parseFloat((this_annotation.all_rect[1] * save_height * scale_y)
		.toFixed(point_num));
	var group = new fabric.Group(group_list, {
		id: this_annotation.id,
		left: all_left,
		top: all_top,
		angle: 0,
		opacity: this_opacity,
		hasControls: false, //scale or not 选中时是否可以放大缩小
		hasRotatingPoint: false, //rotate or not 选中时是否可以旋转
		hasBorders: true, //border or not 选中时是否有边框
		selectable: true, //selectable or not 是否可被选中
		lockMovementX: true, //move in X or not X轴是否可被移动(true为不可，因为前缀是lock)
		lockMovementY: true, //move in Y or not Y轴是否可被移动(true为不可，因为前缀是lock)
	});
	// console.log(group);
	this_fabric_canvas.add(group);
}

//set Fabric layer to top   将 Fabric 层设置为页面最顶层
function setFabricTop(node) {
	// cancelOtherButton(node);
	// console.log('fabric_top',fabric_top);
	if (fabric_top == false) {
		setFabricCanvasContainerZIndex(100);
		fabric_top = true;
		node.getElementsByTagName('i')[0].classList.add('button-active');

		free_draw = false;
		disActivateFreeDraw(); //deactivate draw mode 关闭绘图模式
	} else {
		fabric_top = false;
		setFabricCanvasContainerZIndex(10);
		node.getElementsByTagName('i')[0].classList.remove('button-active');
	}
}

//Sets the layer display level 设置图层的显示级别
function setFabricCanvasContainerZIndex(z_index) {
	var fabs = document.getElementsByClassName('canvas-container');
	for (const fab of fabs) {
		fab.style.zIndex = z_index;
	}

	if (z_index == 10) {
		fabric_top = false;
		free_draw = false;
		disActivateFreeDraw();
	} else {
		start_annotation = false;
		cancelAllAnnotationButtons({
			'id': 'no_id'
		});
	}
}

// deactivate free draw 关闭绘图模式
function disActivateFreeDraw() {
	for (var key in fabric_list) {
		fabric_list[key].page_canvas.fabric_canvas.isDrawingMode = free_draw;
	}
}

//choose and indert image  选择并插入图像
function chooseImage() {
	var tips = {
		'zh-cn': [
			'无法加载图片'
		],
		'en': [
			'can not load image'
		]
	} [tips_language];

	//activate selectable mode 激活选择模式
	if (fabric_top == false) {
		var top_node = document.getElementById('ff-pointer-obj');
		setFabricTop(top_node);
	}

	var fabricObj = getCurrentPageFabricCanvas();
	var fabric_item_id = buildId(fabricObj.getObjects().length + 1);
	if (fabricObj) {
		var inputElement = document.getElementById("image_insert");
		inputElement.onchange = function(ev) {
			const file = ev.target.files[0];
			const blobURL = URL.createObjectURL(file);
			const img = new Image();
			img.setAttribute('crossOrigin', 'Anonymous');
			img.src = blobURL;
			img.onerror = function() {
				URL.revokeObjectURL(this.src);
				alert(tips[0]);
			};
			img.onload = function() {
				const MAX_WIDTH = 500;
				const MAX_HEIGHT = 500;
				const MIME_TYPE = 'image/png';
				const QUALITY = 1;

				URL.revokeObjectURL(this.src);
				const [newWidth, newHeight] = calculateSize(
					img,
					MAX_WIDTH,
					MAX_HEIGHT
				);
				const canvas = document.createElement('canvas');
				canvas.width = newWidth;
				canvas.height = newHeight;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, newWidth, newHeight);

				var new_image = new Image();
				// The value is set to anonymous, indicating that CORS requests for this element will not set credential flags. You cannot export a canvas or an object on a canvas as a picture without setting it.
				//值设置为 anonymous，表示对此元素的 CORS 请求将不设置凭据标志。若不设置，无法将画布或画布上的对象导出为图片。
				new_image.setAttribute('crossOrigin', 'Anonymous');
				new_image.onload = function() {
					var set_img = new fabric.Image(new_image);
					set_img.crossOrigin = "Anonymous"; //这里是主要添加的属性
					fabricObj.add(set_img);
					saveAllFabricData();
				}
				var img_data = canvas.toDataURL('image/png');
				new_image.src = img_data;
			};
		};
		inputElement.click()
	}
}

//read file size 读取文件大小
function readableBytes(bytes) {
	const i = Math.floor(Math.log(bytes) / Math.log(1024)),
		sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

	return (bytes / Math.pow(1024, i)).toFixed(2) + ' ' + sizes[i];
}

//caculate file size 计算文件大小
function calculateSize(img, maxWidth, maxHeight) {
	let width = img.width;
	let height = img.height;

	// calculate the width and height, constraining the proportions
	if (width > height) {
		if (width > maxWidth) {
			height = Math.round((height * maxWidth) / width);
			width = maxWidth;
		}
	} else {
		if (height > maxHeight) {
			width = Math.round((width * maxHeight) / height);
			height = maxHeight;
		}
	}
	return [width, height];
}

//add fabric object添加fabric对象
function addFabricObj(node, option) {
	var tips = {
		'zh-cn': [
			'点击输入文字'
		],
		'en': [
			'click to input text'
		]
	} [tips_language];

	//activate 激活选择模式
	if (fabric_top == false) {
		var top_node = document.getElementById('ff-pointer-obj');
		setFabricTop(top_node);
	}

	// setFabricCanvasContainerZIndex(100);
	var fabricObj = getCurrentPageFabricCanvas();
	var fabric_item_id = buildId(fabricObj.getObjects().length + 1);
	// console.log('fabricObj', fabricObj);
	switch (option) {
		case 2:
			//addd text 增加文字
			default_text['id'] = fabric_item_id;
			var text = new fabric.IText(tips[0], default_text);
			fabricObj.add(text);
			break;

		case 3:
			//add arrow 增加箭头
			var left_top_offset = 20;
			var triangle = new fabric.Triangle(default_triangle);

			var line = new fabric.Line([0, 100, 170, 100], default_line);

			var objs = [line, triangle];

			var alltogetherObj = new fabric.Group(objs, {
				id: fabric_item_id,
			});
			alltogetherObj.set({
				scaleX: 2,
				scaleY: 2
			});
			fabricObj.add(alltogetherObj);
			break;
		case 4:
			//add rectangle 增加矩形
			default_rectangle['id'] = fabric_item_id;
			var rect = new fabric.Rect(default_rectangle);
			fabricObj.add(rect);
			break;
		case 5:
			//add circle 增加圆形
			default_circle['id'] = fabric_item_id;
			var currentCircle = new fabric.Circle(default_circle);
			fabricObj.add(currentCircle);
			break;
		default:
			return;
			saveAllFabricData();
	}
}

//gets the fabric canvas object for the current page 获取当前页面fabric画布对象
function getCurrentPageFabricCanvas() {
	var fabric_obj = getFabricObj(PDFViewerApplication.page);
	return fabric_obj.page_canvas.fabric_canvas;
}

// initail fabric draw 初始化 Fabric 画布
function fabricDraw(node) {
	if (free_draw == false) {
		setFabricCanvasContainerZIndex(100);
		node.getElementsByTagName('i')[0].classList.add('button-active');
		free_draw = true;
	} else {
		setFabricCanvasContainerZIndex(10);
		node.getElementsByTagName('i')[0].classList.remove('button-active');
		free_draw = false;
	}
	fabric_top = false;
	for (var key in fabric_list) {
		fabric_list[key].page_canvas.fabric_canvas.isDrawingMode = free_draw;
	}
}

//delete fabric object by ID  按照 ID 删除 fabric 对象
function deleteFabricObjByID(page_number, anno_id) {
	var fabricObj = getFabricObj(page_number);
	var fabric_canvas = fabricObj.page_canvas.fabric_canvas;
	var items = fabric_canvas.getObjects();
	for (var i = 0; i < items.length; i++) {
		if (items[i].id == anno_id) {
			fabric_canvas.setActiveObject(items[i]);
			fabric_canvas.remove(items[i]);
			break;
		}
	}
}

// listen fabric mouse up
function fabricMouseUp(opt) {
	if (opt.button === 1) {
		var annos_page_id = null;
		for (var key in fabric_list) {
			var active_objs = fabric_list[key].page_canvas.fabric_canvas.getActiveObject();
			if (active_objs != null) {
				var annos_page_id = key;
				break;
			}

		}

		if (annos_page_id == null) {
			hiddenMenu();
			saveAllFabricData();
			return;
		}
		var page_number = annos_page_id.split('-')[3];
		var fabricObj = fabric_list[annos_page_id].page_canvas.fabric_canvas;

		var active_objs = fabricObj.getActiveObject();
		if (active_objs == null) {
			hiddenMenu();
		} else {
			var ac_objs = fabricObj.getActiveObjects();
			ac_objs.forEach(this_obj => {
				this_obj.set({
					borderColor: 'red', //color 边框颜色
					cornerColor: 'red', //color 控制角颜色
					cornerSize: 10, //size 控制角大小
					transparentCorners: false //opacity 控制角填充色不透明
				});
			});
			// // console.log('选中',ac_objs);
			if (ac_objs.length > 1) {
				active_objs.set({
					hasBorders: false,
					borderColor: 'red', //color 边框颜色
					borderScaleFactor: 2,
					hasControls: false,
					perPixelTargetFind: true, //无法通过透明部分选中
					hasRotatingPoint: false, //rotate or not 选中时是否可以旋转
					lockMovementX: true, //move in X or not X轴是否可被移动(true为不可，因为前缀是lock)
					lockMovementY: true, //move in Y or not Y轴是否可被移动(true为不可，因为前缀是lock)
				});
			}

			// 获取当前元素
			active_fabric_obj = {
				'active_canvas': fabricObj,
				'active_element': ac_objs,
				'page_number': page_number,
			}

			// console.log('选中元素', active_fabric_obj);

			// console.log('click_opt', opt.target);
			var menu = document.getElementById('my-menu');
			// 将菜单展示出来
			menu.style = `
			      visibility: visible;
			      z-index: 1000;
			    `
		}
	}
	saveAllFabricData();
}

function fabricMouseDown(opt) {
	// opt.button: 1-左键；2-中键；3-右键
	// 在画布上点击：opt.target 为 null
	// console.log(fabric_list);
	if (opt.button === 1) {
		if (opt.target) {
			var annos_page_id = opt.target.canvas.wrapperEl.children[0].getAttribute('id');
			var page_number = annos_page_id.split('-')[3];
			var fabricObj = fabric_list[annos_page_id].page_canvas.fabric_canvas;
			// 获取当前元素
			active_fabric_obj = {
				'active_canvas': fabricObj,
				'active_element': opt.target,
				'page_number': page_number,
			}

			opt.target.set({
				borderColor: 'red', //color 边框颜色
				cornerColor: 'red', //color 控制角颜色
				cornerSize: 10, //size 控制角大小
				transparentCorners: false //opacity 控制角填充色不透明
			});

			// console.log('click_opt', opt.target);
			var menu = document.getElementById('my-menu');
			// menu.domReady = function() {
			// 	console.log(123)
			// }

			// 显示菜单，设置右键菜单位置
			// 获取菜单组件的宽高
			const menuWidth = menu.offsetWidth
			const menuHeight = menu.offsetHeight

			// 当前鼠标位置
			let pointX = opt.pointer.x
			let pointY = opt.pointer.y

			// 计算菜单出现的位置
			// 如果鼠标靠近画布右侧，菜单就出现在鼠标指针左侧
			if (fabricObj.width - pointX <= menuWidth) {
				pointX -= menuWidth
			}
			// 如果鼠标靠近画布底部，菜单就出现在鼠标指针上方
			if (fabricObj.height - pointY <= menuHeight) {
				pointY -= menuHeight
			}
			// 将菜单展示出来
			menu.style = `
			      visibility: visible;
			      z-index: 1000;
			    `
		} else {
			hiddenMenu();
		}
	}
	//保存页面上所有fabric数据
	saveAllFabricData();
}

//hidemenu 隐藏菜单
function hiddenMenu() {
	var menu = document.getElementById('my-menu');
	menu.style = `
		    visibility: hidden;
		    z-index: -100;
		  `
	// The current active element is null 当前活动元素置空
	active_fabric_obj = {
		'page_number': null,
		'active_element': null,
		'page_number': null,
	}
}

function deactivateAllObjs() {
	for (var key in fabric_list) {
		fabric_list[key].page_canvas.fabric_canvas.discardActiveObject();
	}
}

// delete select annotation element 删除元素
function delEl() {
	var tips = {
		'zh-cn': [
			'确认删除选中对象?'
		],
		'en': [
			'Are you sure to delete it?'
		]
	} [tips_language];
	//delete select annoataion 删除选中对象
	setTimeout(() => {
		if (confirm(tips[0])) {
			var activeEls = active_fabric_obj['active_element'];
			var fabricObj = active_fabric_obj['active_canvas'];
			var page_number = active_fabric_obj['page_number'];
			//删除多个批注对象
			activeEls.forEach(activeEl => {
				fabricObj.remove(activeEl);
				deleteAnnotationsListByID(page_number, activeEl.id);
			})
			hiddenMenu();
		} else {
			hiddenMenu();
		}
	}, 100);
}

//observe value change  监听颜色等数字变化
function observeValue(property) {
	document.getElementById(property).oninput = function() {
		// console.log('颜色', this.value);
		var activeEls = active_fabric_obj['active_element'];
		var fabricObj = active_fabric_obj['active_canvas'];
		activeEls.forEach(activeEl => {
			// activeEl[property] = this.value;
			if (activeEl.type == 'group') {
				var objs = activeEl['_objects'];
				for (var i = 0; i < objs.length; i++) {
					if (property == 'fill') {
						if (objs[i].type == 'line') {
							objs[i].set('stroke', this.value);
						} else {
							objs[i].set(property, this.value);
						}
					} else {
						objs[i].set(property, this.value);
					}
				}
			} else {
				activeEl.set(property, this.value);
			}
		});
		fabricObj.requestRenderAll();
	};
}

//set member id 设置用户id
function setMemberId(new_member_id) {
	member_id = new_member_id
}

//observe numeric change  监听不透明度等数字变化
function observeNumeric(property) {
	document.getElementById(property).oninput = function() {
		var activeEls = active_fabric_obj['active_element'];
		var fabricObj = active_fabric_obj['active_canvas'];
		// activeEl[property] = this.value;
		// console.log(property, parseInt(this.value));
		activeEls.forEach(activeEl => {
			var this_value = parseFloat(this.value);
			if (property == 'opacity') {
				this_value = this_value / 100;
			}
			activeEl.set(property, this_value);
		});
		fabricObj.requestRenderAll();
	};
}

//delete annotation html element showing list by ID   按照id删除展示列表中的 html 元素
function deleteAnnotationsListByID(page_number, anno_id) {
	var this_annotation_id = PDFViewerApplication.baseUrl + '_page_' + page_number;
	var this_annotations_json = readAnnotationsForPage(this_annotation_id);
	var anno_number = getAnnoNumber(this_annotations_json, anno_id);
	this_annotations_json.splice(anno_number, 1);
	//重新修改注释
	saveAnnotationsJson(this_annotation_id, this_annotations_json);
	saveAllFabricData();
}

//click to input color 点击后输入颜色
function clickColorInput(node) {
	var this_input = node.getElementsByTagName('input')[0];
	this_input.click();
}

// clear all Fabric layer list  清空 Fabric 图层的列表
function refreshFabricState() {
	fabric_list = {};
}

//Keep the gesture zoom force for pdf render pages 保留pdf渲染页面的手势缩放
function forceZoomIn() {
	var DEFAULT_SCALE_DELTA = 1.1;
	var MAX_SCALE = 10.0;
	let newScale = window.PDFViewerApplication.pdfViewer.currentScale;
	newScale = (newScale * DEFAULT_SCALE_DELTA).toFixed(2);
	newScale = Math.ceil(newScale * 10) / 10;
	newScale = Math.min(MAX_SCALE, newScale);
	window.PDFViewerApplication.pdfViewer.currentScaleValue = newScale;
	//draw annotation 绘制批注
	drawAllPageAnnotations();
}
//Keep the gesture zoom force for pdf render pages 保留pdf渲染页面的手势缩放
function forceZoomOut() {
	var DEFAULT_SCALE_DELTA = 1.1;
	var MIN_SCALE = 0.1;
	let newScale = window.PDFViewerApplication.pdfViewer.currentScale;
	newScale = (newScale / DEFAULT_SCALE_DELTA).toFixed(2);
	newScale = Math.floor(newScale * 10) / 10;
	newScale = Math.max(MIN_SCALE, newScale);
	window.PDFViewerApplication.pdfViewer.currentScaleValue = newScale;
	//draw annotation 绘制批注
	drawAllPageAnnotations();
}

//listn touch event 绑定触屏事件
function addPinchListener() {
	let element = document.getElementById("viewerContainer");
	element.addEventListener("touchstart", onTouchStart, false);
	element.addEventListener("touchmove", onTouchMove, false);
	element.addEventListener("touchend", onTouchEnd, false);
}

//record touches coordinate for start and end 记录触屏触点坐标 记录起始和结束点
function onTouchStart(evt) {
	touchState = {
		//first touch for all touch 多点触屏的第一点
		startX: evt.touches[0].pageX,
		startY: evt.touches[0].pageY,
		endX: evt.touches[0].pageX,
		endY: evt.touches[0].pageY,

		//second touch for all touch 多点触屏的第二点  单点触屏时记录坐标为 -1 
		startX2: evt.touches[1] ? evt.touches[1].pageX : -1,
		startY2: evt.touches[1] ? evt.touches[1].pageY : -1,
		endX2: evt.touches[1] ? evt.touches[1].pageX : -1,
		endY2: evt.touches[1] ? evt.touches[1].pageY : -1
	};
}

//Record the touch screen contact coordinates Update the end point coordinates when the touch screen moves 记录触屏触点坐标 触屏移动时更新结束点坐标
function onTouchMove(evt) {
	if (touchState === null) {
		return;
	}
	touchState.endX = evt.touches[0].pageX;
	touchState.endY = evt.touches[0].pageY;
	touchState.endX2 = evt.touches[1] ? evt.touches[1].pageX : -1;
	touchState.endY2 = evt.touches[1] ? evt.touches[1].pageY : -1;
}


//Decide whether to zoomIn or zoomUut at the end of the touch screen 触屏结束时 判断是否放大缩小
function onTouchEnd(evt) {
	if (touchState === null) {
		return evt; //return touch event otherwise through error 返回触屏事件，否则报错[Intervention] Ignored attempt to cancel a touchend event with cancelable=false, for example because scrol
	}
	//Calculate the distance between two touches points 计算触屏两点间距离
	var getDistance = function(startX, startY, endX, endY) {
		return Math.hypot(endX - startX, endY - startY);
	};

	if (touchState.startX2 != -1 && touchState.endX2 != -1 && touchState.startY2 != -1 && touchState.endY2 != -1) {
		let distanceStart = getDistance(touchState.startX, touchState.startY, touchState.startX2, touchState.startY2);
		let distanceEnd = getDistance(touchState.endX, touchState.endY, touchState.endX2, touchState.endY2);
		// Compare the distance between two points at the beginning and two single distances at the end to determine whether it is method or reduction
		//起始时两点距离和结束时两单距离进行比较，判断是方法还是缩小
		if (distanceStart < distanceEnd) {
			forceZoomIn();
		} else if (distanceStart > distanceEnd) {
			forceZoomOut();
		}
	}
}
