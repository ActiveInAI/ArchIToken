//! Cursor pagination helpers for in-memory module API previews.

use serde::Serialize;

use crate::error::{HarnessError, Result};

const DEFAULT_LIMIT: usize = 100;
const MAX_LIMIT: usize = 500;

/// Pagination metadata returned by list APIs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PageInfo {
    /// Applied page size.
    pub limit: usize,
    /// Opaque cursor for the next page, if more results are available.
    pub next_cursor: Option<String>,
    /// Whether another page can be requested.
    pub has_more: bool,
}

/// Page returned by in-memory list services.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ListPage<T> {
    /// Items included in this page.
    pub items: Vec<T>,
    /// Pagination metadata.
    pub page_info: PageInfo,
}

/// Apply minimal offset-backed cursor pagination to a filtered list.
///
/// # Errors
/// Returns [`HarnessError::InvalidInput`] when the provided cursor is not a
/// valid offset or the requested limit is zero.
pub fn paginate<T>(items: &[T], limit: Option<usize>, cursor: Option<&str>) -> Result<ListPage<T>>
where
    T: Clone,
{
    let limit = limit.unwrap_or(DEFAULT_LIMIT).min(MAX_LIMIT);
    if limit == 0 {
        return Err(HarnessError::InvalidInput(
            "limit must be greater than zero".to_owned(),
        ));
    }

    let offset = cursor
        .filter(|value| !value.trim().is_empty())
        .map(str::parse::<usize>)
        .transpose()
        .map_err(|_| HarnessError::InvalidInput("cursor must be a numeric offset".to_owned()))?
        .unwrap_or(0);

    let page_items: Vec<T> = items.iter().skip(offset).take(limit).cloned().collect();
    let next_offset = offset.saturating_add(page_items.len());
    let has_more = next_offset < items.len();
    let next_cursor = has_more.then(|| next_offset.to_string());

    Ok(ListPage {
        items: page_items,
        page_info: PageInfo {
            limit,
            next_cursor,
            has_more,
        },
    })
}

#[cfg(test)]
mod tests {
    use super::paginate;

    #[test]
    fn paginates_by_numeric_cursor() {
        let items = vec![1, 2, 3];
        let page = paginate(&items, Some(2), None).expect("page should work");
        assert_eq!(page.items, vec![1, 2]);
        assert_eq!(page.page_info.next_cursor.as_deref(), Some("2"));
        assert!(page.page_info.has_more);

        let page = paginate(&items, Some(2), page.page_info.next_cursor.as_deref())
            .expect("second page should work");
        assert_eq!(page.items, vec![3]);
        assert_eq!(page.page_info.next_cursor, None);
        assert!(!page.page_info.has_more);
    }

    #[test]
    fn rejects_invalid_cursor() {
        let err = paginate(&[1], Some(1), Some("bad")).expect_err("cursor should fail");
        assert_eq!(err.http_status(), 400);
    }
}
