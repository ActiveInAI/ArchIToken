// License: Apache-2.0

package componentbom

import (
	"archive/zip"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"path"
	"strconv"
	"strings"
)

type WorkbookManifest struct {
	SourcePath        string    `json:"sourcePath"`
	SheetName         string    `json:"sheetName"`
	SheetDimension    string    `json:"sheetDimension"`
	CategorySheet     string    `json:"categorySheet"`
	CategoryDimension string    `json:"categoryDimension"`
	LineCount         int       `json:"lineCount"`
	TotalQuantity     float64   `json:"totalQuantity"`
	Lines             []BomLine `json:"lines"`
}

type BomLine struct {
	LineNo        int      `json:"lineNo"`
	SourceRow     int      `json:"sourceRow"`
	CategoryName  string   `json:"categoryName"`
	CategoryCode  string   `json:"categoryCode"`
	ComponentName string   `json:"componentName"`
	SectionSize   string   `json:"sectionSize"`
	LengthMM      float64  `json:"lengthMm"`
	PositionRef   string   `json:"positionRef"`
	MaterialGrade string   `json:"materialGrade"`
	Specification string   `json:"specification"`
	DrawingNo     string   `json:"drawingNo"`
	FloorLevel    string   `json:"floorLevel"`
	Unit          string   `json:"unit"`
	SetQuantity   float64  `json:"setQuantity"`
	TotalQuantity float64  `json:"totalQuantity"`
	UnitWeightKG  *float64 `json:"unitWeightKg,omitempty"`
	TotalWeightKG *float64 `json:"totalWeightKg,omitempty"`
}

type workbookXML struct {
	Sheets []sheetXML `xml:"sheets>sheet"`
}

type sheetXML struct {
	Name string `xml:"name,attr"`
	RID  string `xml:"http://schemas.openxmlformats.org/officeDocument/2006/relationships id,attr"`
}

type relationshipsXML struct {
	Relationships []relationshipXML `xml:"Relationship"`
}

type relationshipXML struct {
	ID     string `xml:"Id,attr"`
	Target string `xml:"Target,attr"`
}

type sharedStringsXML struct {
	Items []sharedStringItemXML `xml:"si"`
}

type sharedStringItemXML struct {
	Texts []string `xml:"t"`
}

type worksheetXML struct {
	Dimension dimensionXML `xml:"dimension"`
	Rows      []rowXML     `xml:"sheetData>row"`
}

type dimensionXML struct {
	Ref string `xml:"ref,attr"`
}

type rowXML struct {
	Index int       `xml:"r,attr"`
	Cells []cellXML `xml:"c"`
}

type cellXML struct {
	Ref   string `xml:"r,attr"`
	Type  string `xml:"t,attr"`
	Value string `xml:"v"`
	Text  string `xml:"is>t"`
}

func ReadWorkbookManifest(sourcePath string) (*WorkbookManifest, error) {
	reader, err := zip.OpenReader(sourcePath)
	if err != nil {
		return nil, fmt.Errorf("open xlsx: %w", err)
	}
	defer reader.Close()

	workbook, err := readWorkbook(&reader.Reader)
	if err != nil {
		return nil, err
	}
	rels, err := readRelationships(&reader.Reader)
	if err != nil {
		return nil, err
	}
	sharedStrings, err := readSharedStrings(&reader.Reader)
	if err != nil {
		return nil, err
	}

	var materialSheet *sheetXML
	var categorySheet *sheetXML
	for i := range workbook.Sheets {
		sheet := &workbook.Sheets[i]
		switch sheet.Name {
		case "物料清单":
			materialSheet = sheet
		case "类目参照":
			categorySheet = sheet
		}
	}
	if materialSheet == nil {
		return nil, errors.New("sheet 物料清单 not found")
	}

	materialWorksheet, err := readWorksheet(&reader.Reader, relationshipTarget(rels, materialSheet.RID), sharedStrings)
	if err != nil {
		return nil, fmt.Errorf("read material sheet: %w", err)
	}

	categoryDimension := ""
	if categorySheet != nil {
		categoryWorksheet, err := readWorksheet(&reader.Reader, relationshipTarget(rels, categorySheet.RID), sharedStrings)
		if err == nil {
			categoryDimension = categoryWorksheet.Dimension.Ref
		}
	}

	lines := materialLines(materialWorksheet)
	totalQuantity := 0.0
	for _, line := range lines {
		totalQuantity += line.TotalQuantity
	}

	return &WorkbookManifest{
		SourcePath:        sourcePath,
		SheetName:         materialSheet.Name,
		SheetDimension:    materialWorksheet.Dimension.Ref,
		CategorySheet:     "类目参照",
		CategoryDimension: categoryDimension,
		LineCount:         len(lines),
		TotalQuantity:     totalQuantity,
		Lines:             lines,
	}, nil
}

func readWorkbook(reader *zip.Reader) (*workbookXML, error) {
	var workbook workbookXML
	if err := readXML(reader, "xl/workbook.xml", &workbook); err != nil {
		return nil, fmt.Errorf("read workbook: %w", err)
	}
	return &workbook, nil
}

func readRelationships(reader *zip.Reader) (map[string]string, error) {
	var rels relationshipsXML
	if err := readXML(reader, "xl/_rels/workbook.xml.rels", &rels); err != nil {
		return nil, fmt.Errorf("read workbook relationships: %w", err)
	}
	result := make(map[string]string, len(rels.Relationships))
	for _, rel := range rels.Relationships {
		result[rel.ID] = rel.Target
	}
	return result, nil
}

func readSharedStrings(reader *zip.Reader) ([]string, error) {
	var shared sharedStringsXML
	if err := readXML(reader, "xl/sharedStrings.xml", &shared); err != nil {
		if errors.Is(err, fsNotFoundError{}) {
			return nil, nil
		}
		return nil, fmt.Errorf("read shared strings: %w", err)
	}
	values := make([]string, 0, len(shared.Items))
	for _, item := range shared.Items {
		values = append(values, strings.Join(item.Texts, ""))
	}
	return values, nil
}

func readWorksheet(reader *zip.Reader, target string, sharedStrings []string) (*worksheetXML, error) {
	if target == "" {
		return nil, errors.New("worksheet target is empty")
	}
	target = strings.TrimPrefix(target, "/")
	if !strings.HasPrefix(target, "xl/") {
		target = path.Join("xl", target)
	}
	var worksheet worksheetXML
	if err := readXML(reader, target, &worksheet); err != nil {
		return nil, err
	}
	for rowIndex := range worksheet.Rows {
		for cellIndex := range worksheet.Rows[rowIndex].Cells {
			cell := &worksheet.Rows[rowIndex].Cells[cellIndex]
			cell.Value = resolveCellValue(*cell, sharedStrings)
		}
	}
	return &worksheet, nil
}

func relationshipTarget(rels map[string]string, rid string) string {
	return rels[rid]
}

type fsNotFoundError struct{}

func (fsNotFoundError) Error() string { return "zip entry not found" }

func readXML(reader *zip.Reader, name string, target any) error {
	for _, file := range reader.File {
		if file.Name != name {
			continue
		}
		handle, err := file.Open()
		if err != nil {
			return err
		}
		defer handle.Close()
		bytes, err := io.ReadAll(handle)
		if err != nil {
			return err
		}
		if err := xml.Unmarshal(bytes, target); err != nil {
			return err
		}
		return nil
	}
	return fsNotFoundError{}
}

func resolveCellValue(cell cellXML, sharedStrings []string) string {
	if cell.Type == "inlineStr" {
		return cell.Text
	}
	if cell.Type != "s" {
		return strings.TrimSpace(cell.Value)
	}
	index, err := strconv.Atoi(strings.TrimSpace(cell.Value))
	if err != nil || index < 0 || index >= len(sharedStrings) {
		return ""
	}
	return sharedStrings[index]
}

func materialLines(sheet *worksheetXML) []BomLine {
	lines := make([]BomLine, 0)
	for _, row := range sheet.Rows {
		values := rowValues(row)
		lineNo, ok := parseInt(values["A"])
		if !ok || lineNo <= 0 {
			continue
		}
		componentName := values["D"]
		if componentName == "" {
			continue
		}
		line := BomLine{
			LineNo:        lineNo,
			SourceRow:     row.Index,
			CategoryName:  values["B"],
			CategoryCode:  values["C"],
			ComponentName: componentName,
			SectionSize:   values["E"],
			LengthMM:      parseFloatOrZero(values["F"]),
			PositionRef:   values["G"],
			MaterialGrade: values["H"],
			Specification: values["I"],
			DrawingNo:     values["J"],
			FloorLevel:    values["K"],
			Unit:          values["L"],
			SetQuantity:   parseFloatOrZero(values["M"]),
			TotalQuantity: parseFloatOrZero(values["N"]),
			UnitWeightKG:  parseOptionalFloat(values["O"]),
			TotalWeightKG: parseOptionalFloat(values["P"]),
		}
		lines = append(lines, line)
	}
	return lines
}

func rowValues(row rowXML) map[string]string {
	values := make(map[string]string, len(row.Cells))
	for _, cell := range row.Cells {
		values[cellColumn(cell.Ref)] = strings.TrimSpace(cell.Value)
	}
	return values
}

func cellColumn(ref string) string {
	var builder strings.Builder
	for _, r := range ref {
		if r >= 'A' && r <= 'Z' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func parseInt(value string) (int, bool) {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	return parsed, err == nil
}

func parseFloatOrZero(value string) float64 {
	parsed, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
	if err != nil {
		return 0
	}
	return parsed
}

func parseOptionalFloat(value string) *float64 {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return nil
	}
	return &parsed
}
